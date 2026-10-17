param([Parameter(Mandatory=$true)][int]$AppProcessId)
$env:PSModulePath = Join-Path $PSHOME 'Modules'
$taskProcesses = Get-CimInstance Win32_Process
$taskById = @{}
foreach ($taskProcess in $taskProcesses) { $taskById[[int]$taskProcess.ProcessId] = $taskProcess }
$taskIds = [System.Collections.Generic.HashSet[int]]::new()
[void]$taskIds.Add($AppProcessId)
do {
  $taskAdded = $false
  foreach ($taskProcess in $taskProcesses) {
    $taskParent = $taskById[[int]$taskProcess.ParentProcessId]
    if ($taskIds.Contains([int]$taskProcess.ParentProcessId) -and $taskParent -and
        $taskProcess.CreationDate -ge $taskParent.CreationDate -and
        $taskIds.Add([int]$taskProcess.ProcessId)) { $taskAdded = $true }
  }
} while ($taskAdded)
$taskSamples = @(Get-Process -Id @($taskIds) -ErrorAction SilentlyContinue | Select-Object Id,ProcessName,WorkingSet64,PrivateMemorySize64,CPU)
$taskGpu = @()
try {
  $taskCounters = Get-Counter '\GPU Engine(*)\Utilization Percentage' -SampleInterval 1 -MaxSamples 2 -ErrorAction Stop
  $taskGpu = @($taskCounters[-1].CounterSamples | Where-Object {
    $_.InstanceName -match 'pid_(\d+)_' -and $taskIds.Contains([int]$Matches[1])
  } | Select-Object InstanceName,CookedValue)
} catch { }
@{ processes = $taskSamples; gpu = $taskGpu } | ConvertTo-Json -Depth 4 -Compress
