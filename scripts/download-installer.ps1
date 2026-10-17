param(
  [Parameter(Mandatory = $true)][string]$Config,
  [Parameter(Mandatory = $true)][string]$Destination
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$env:PSModulePath = Join-Path $PSHOME 'Modules'
$cache = $null
try {
  $settings = Get-Content -LiteralPath $Config -Raw | ConvertFrom-Json
  $downloadUri = [uri]$settings.url
  if ($downloadUri.Scheme -ne 'https' -or $downloadUri.Host -ne 'github.com' -or
      !$downloadUri.AbsolutePath.StartsWith('/linerighI/exams/releases/download/')) {
    throw 'The download must be a release from linerighI/exams on GitHub.'
  }
  if ($settings.sha256 -notmatch '^[a-fA-F0-9]{64}$' -or [long]$settings.size -lt 1) {
    throw 'Invalid installer checksum or size.'
  }
  # Cache by the pinned digest, so a newer release cannot reuse an older package.
  $cache = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) ('Alshereqi Exams WebView2\InstallerCache\' + $settings.sha256.ToLowerInvariant())
  New-Item -ItemType Directory -Path $cache -Force | Out-Null
  $cachedInstaller = Join-Path $cache 'verified-setup.exe'
  if ((Test-Path -LiteralPath $cachedInstaller) -and
      (Get-Item -LiteralPath $cachedInstaller).Length -eq [long]$settings.size -and
      (Get-FileHash -LiteralPath $cachedInstaller -Algorithm SHA256).Hash -eq $settings.sha256) {
    Write-Output 'Reusing the previously verified download.'
  } else {
    # Load the prebuilt AnyCPU helper; never compile C# from an NSIS temporary folder.
    Add-Type -AssemblyName System.Net.Http
    Add-Type -Path (Join-Path $PSScriptRoot 'ParallelInstallerDownload.dll')
    $download = New-Object SchoolInstaller.ParallelDownload
    Write-Output 'Downloading from GitHub using four connections. Saved progress will resume automatically.'
    $task = $download.DownloadAsync($downloadUri.AbsoluteUri, $cache, $cachedInstaller, [long]$settings.size, 16777216, 4)
    $clock = [Diagnostics.Stopwatch]::StartNew()
    [long]$previous = $download.Received
    while (!$task.IsCompleted) {
      Start-Sleep -Seconds 1
      [long]$current = $download.Received
      $speed = [math]::Max(0, ($current - $previous) / [math]::Max(.1, $clock.Elapsed.TotalSeconds))
      $eta = if ($speed -gt 0) { '{0:mm\:ss}' -f [TimeSpan]::FromSeconds(([long]$settings.size - $current) / $speed) } else { 'estimating' }
      Write-Output ('{0}% - {1:N0} / {2:N0} MiB - {3:N1} MiB/s - remaining {4}' -f [math]::Floor(100 * $current / $settings.size), ($current / 1MB), ($settings.size / 1MB), ($speed / 1MB), $eta)
      $previous = $current
      $clock.Restart()
    }
    $task.GetAwaiter().GetResult() | Out-Null
    Write-Output 'Verifying the downloaded installer...'
    if ((Get-Item -LiteralPath $cachedInstaller).Length -ne [long]$settings.size -or
        (Get-FileHash -LiteralPath $cachedInstaller -Algorithm SHA256).Hash -ne $settings.sha256) {
      # Only clear this digest's generated files when validation fails; network failures retain parts.
      Get-ChildItem -LiteralPath $cache -File | Where-Object { $_.Name -match '^\d{5}\.part$|^verified-setup\.exe$' } | ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force }
      throw 'Installer checksum mismatch. The download will not be run.'
    }
  }
  Copy-Item -LiteralPath $cachedInstaller -Destination $Destination -Force
  Get-ChildItem -LiteralPath $cache -File -Filter '*.part' | ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force }
  Write-Output 'Download verified successfully.'
} catch {
  if (Test-Path -LiteralPath $Destination) { Remove-Item -LiteralPath $Destination -Force }
  Write-Output ('Download failed: ' + $_.Exception.Message + ' Run setup again to resume saved progress.')
  exit 1
}
