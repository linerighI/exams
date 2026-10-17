param([switch]$RefreshRuntime)
$ErrorActionPreference = 'Stop'
# npm may inherit PowerShell 7 module paths while launching Windows PowerShell 5.
$env:PSModulePath = Join-Path $PSHOME 'Modules'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskTools = Join-Path $taskRoot '.tools'
New-Item -ItemType Directory -Force $taskTools | Out-Null
$taskRuntime = Join-Path $taskTools 'MicrosoftEdgeWebView2RuntimeInstallerX64.exe'
if ($RefreshRuntime -or !(Test-Path -LiteralPath $taskRuntime)) {
  Invoke-WebRequest 'https://go.microsoft.com/fwlink/?linkid=2124701' -OutFile $taskRuntime
}
$taskSignature = Get-AuthenticodeSignature -LiteralPath $taskRuntime
if ($taskSignature.Status -ne 'Valid' -or $taskSignature.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation') {
  throw 'WebView2 offline installer must have a valid Microsoft Authenticode signature'
}
$taskNsis = Join-Path $taskTools 'nsis/Bin/makensis.exe'
if (!(Test-Path -LiteralPath $taskNsis)) {
  $taskArchive = Join-Path $taskTools 'nsis-3.0.4.1.7z'
  $taskExpectedHash = '9877df902530f96357d13a7a31ae2b9df67f48b11ffc9a1700a7c961574ec5fa'
  if (!(Test-Path -LiteralPath $taskArchive)) {
    Invoke-WebRequest 'https://github.com/electron-userland/electron-builder-binaries/releases/download/nsis-3.0.4.1/nsis-3.0.4.1.7z' -OutFile $taskArchive
  }
  if ((Get-FileHash -LiteralPath $taskArchive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskExpectedHash) {
    throw 'NSIS compiler checksum mismatch'
  }
  $taskDestination = Join-Path $taskTools 'nsis'
  New-Item -ItemType Directory -Force $taskDestination | Out-Null
  & tar -xf $taskArchive -C $taskDestination
  if ($LASTEXITCODE -ne 0) { throw 'NSIS archive extraction failed' }
}
Write-Host 'Offline runtime and NSIS compiler are ready.'
