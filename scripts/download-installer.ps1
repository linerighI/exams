param(
  [Parameter(Mandatory = $true)][string]$Config,
  [Parameter(Mandatory = $true)][string]$Destination
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$client = $null
$response = $null
$inputStream = $null
$outputStream = $null
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
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Add-Type -AssemblyName System.Net.Http
  $client = New-Object System.Net.Http.HttpClient
  $client.Timeout = [TimeSpan]::FromMinutes(30)
  $client.DefaultRequestHeaders.UserAgent.ParseAdd('Alshereqi-Exams-Online-Setup/1.0')
  Write-Output 'Downloading the application from GitHub...'
  $response = $client.GetAsync($downloadUri, [Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
  $response.EnsureSuccessStatusCode() | Out-Null
  $inputStream = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
  $outputStream = [IO.File]::Create($Destination)
  $buffer = New-Object byte[] (1024 * 1024)
  [long]$received = 0
  [long]$reported = 0
  while (($count = $inputStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
    $received += $count
    if ($received -gt [long]$settings.size) { throw 'Download exceeded the expected package size.' }
    $outputStream.Write($buffer, 0, $count)
    if ($received - $reported -ge 10MB) {
      Write-Output ('Downloaded {0} / {1} MB ({2}%)' -f [math]::Round($received / 1MB), [math]::Round($settings.size / 1MB), [math]::Floor(100 * $received / $settings.size))
      $reported = $received
    }
  }
  $outputStream.Dispose()
  $outputStream = $null
  if ($received -ne [long]$settings.size) { throw 'The download was incomplete. Please run setup again.' }
  Write-Output 'Verifying the downloaded installer...'
  $actualHash = (Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash
  if ($actualHash -ne $settings.sha256) { throw 'Installer checksum mismatch. The download will not be run.' }
  Write-Output 'Download verified successfully.'
} catch {
  if ($outputStream) { $outputStream.Dispose(); $outputStream = $null }
  if (Test-Path -LiteralPath $Destination) { Remove-Item -LiteralPath $Destination -Force }
  Write-Output ('Download failed: ' + $_.Exception.Message)
  exit 1
} finally {
  if ($outputStream) { $outputStream.Dispose() }
  if ($inputStream) { $inputStream.Dispose() }
  if ($response) { $response.Dispose() }
  if ($client) { $client.Dispose() }
}
