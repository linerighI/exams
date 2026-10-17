$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskExecutable = Join-Path $taskRoot 'desktop/native/bin/dev/Alshereqi Exams.exe'
if (!(Test-Path -LiteralPath $taskExecutable)) { exit 0 }
$taskExecutable = (Resolve-Path -LiteralPath $taskExecutable).Path
$taskWindows = @(Get-Process -Name 'Alshereqi Exams' -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $taskExecutable })
foreach ($taskWindow in $taskWindows) { [void]$taskWindow.CloseMainWindow() }
foreach ($taskWindow in $taskWindows) {
  if (!$taskWindow.WaitForExit(5000)) { throw 'Close the current development app window before rebuilding.' }
}
