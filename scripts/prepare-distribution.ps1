param([switch]$RefreshRuntime)
$ErrorActionPreference = 'Stop'
# npm may inherit PowerShell 7 module paths while launching Windows PowerShell 5.
$env:PSModulePath = Join-Path $PSHOME 'Modules'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskTools = Join-Path $taskRoot '.tools'
New-Item -ItemType Directory -Force $taskTools | Out-Null
$taskRuntime = Join-Path $taskTools 'MicrosoftEdgeWebView2RuntimeInstallerX64.exe'
if ($RefreshRuntime -or !(Test-Path -LiteralPath $taskRuntime)) {
  & node (Join-Path $PSScriptRoot 'download-distribution.cjs') webview2
  if ($LASTEXITCODE -ne 0) { throw 'WebView2 runtime download failed' }
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
    & node (Join-Path $PSScriptRoot 'download-distribution.cjs') nsis
    if ($LASTEXITCODE -ne 0) { throw 'NSIS compiler download failed' }
  }
  if ((Get-FileHash -LiteralPath $taskArchive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskExpectedHash) {
    throw 'NSIS compiler checksum mismatch'
  }
  $taskDestination = Join-Path $taskTools 'nsis'
  New-Item -ItemType Directory -Force $taskDestination | Out-Null
  # Windows tar can corrupt Arabic characters in absolute path arguments.
  Push-Location -LiteralPath $taskRoot
  try {
    & tar -xf '.tools/nsis-3.0.4.1.7z' -C '.tools/nsis'
    if ($LASTEXITCODE -ne 0) { throw 'NSIS archive extraction failed' }
  } finally { Pop-Location }
}
Write-Host 'Offline runtime and NSIS compiler are ready.'
