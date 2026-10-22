$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskTools = Join-Path $taskRoot '.tools'
New-Item -ItemType Directory -Force $taskTools | Out-Null
$taskInstaller = Join-Path $taskTools 'dotnet-install.ps1'
Invoke-WebRequest https://dot.net/v1/dotnet-install.ps1 -OutFile $taskInstaller
& $taskInstaller -Channel 10.0 -InstallDir (Join-Path $taskTools 'dotnet') -NoPath
$taskDotnet = Join-Path $taskTools 'dotnet/dotnet.exe'
if (-not (Test-Path -LiteralPath $taskDotnet)) { throw '.NET SDK installation failed' }
$taskSdks = & $taskDotnet --list-sdks
if ($LASTEXITCODE -ne 0 -or -not ($taskSdks -match '^10\.')) { throw '.NET SDK installation failed' }
Write-Host 'Desktop SDK ready. Run npm install, npm run speech:setup, then npm run desktop.'
