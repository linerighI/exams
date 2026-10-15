param([string]$PythonExecutable = 'python')
$ErrorActionPreference = 'Stop'
& $PythonExecutable -m venv worker/build/venv
if ($LASTEXITCODE -ne 0) { throw 'Install Python 3.11 or 3.12 first' }
$taskPython = Join-Path $PSScriptRoot '../worker/build/venv/Scripts/python.exe'
& $taskPython -m pip install -r worker/requirements.txt
if ($LASTEXITCODE -ne 0) { throw 'Worker dependency installation failed' }
& $taskPython worker/setup_models.py
if ($LASTEXITCODE -ne 0) { throw 'OCR model download failed' }
& $taskPython -X utf8 -m PyInstaller --clean --noconfirm --distpath worker/dist --workpath worker/build/pyinstaller scripts/pdf-worker.spec
if ($LASTEXITCODE -ne 0) { throw 'Worker packaging failed' }
Copy-Item -Path worker/dist/pdf-worker/* -Destination worker/runtime -Recurse -Force
Write-Host 'Offline PDF worker is ready. Run npm run dist.'
