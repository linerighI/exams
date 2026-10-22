Unicode True
!include "MUI2.nsh"
!include "x64.nsh"
!include "LogicLib.nsh"
!ifndef APP_VERSION
  !error "APP_VERSION is required"
!endif
Name "Alshereqi Exams - Online Preview Setup"
OutFile "..\release\Alshereqi-Exams-${APP_VERSION}-Online-Preview-Fast-Fix-Setup.exe"
InstallDir "$PROGRAMFILES64\Alshereqi Exams WebView2"
RequestExecutionLevel admin
SetCompressor /SOLID lzma
ShowInstDetails show
!define MUI_ICON "..\build\icon.ico"
!define MUI_WELCOMEPAGE_TITLE "Alshereqi Exams - Preview"
!define MUI_WELCOMEPAGE_TEXT "Setup downloads the application from linerighI/exams on GitHub, verifies it, and installs it.$\r$\n$\r$\nAn internet connection is required to download the full application package. The installed app includes its offline tools.$\r$\n$\r$\nThis is a preview version for testing."
!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_LANGUAGE "English"
Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "This application requires Windows x64."
    Abort
  ${EndIf}
FunctionEnd
Section "Download and install"
  InitPluginsDir
  SetOutPath "$PLUGINSDIR"
  File /oname=download-installer.ps1 "download-installer.ps1"
  File /oname=ParallelInstallerDownload.dll "..\release\ParallelInstallerDownload.dll"
  File /oname=download.json "..\release\online-installer-download.json"
download_retry:
  DetailPrint "Downloading the verified application package from GitHub..."
  nsExec::ExecToLog /TIMEOUT=0 '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\download-installer.ps1" -Config "$PLUGINSDIR\download.json" -Destination "$PLUGINSDIR\application-setup.exe"'
  Pop $0
  ${If} $0 != 0
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "The application could not be downloaded or verified. Check your connection and retry. See the details above for the reason." /SD IDCANCEL IDRETRY download_retry
    SetErrorLevel 1
    Abort
  ${EndIf}
  DetailPrint "Installing Alshereqi Exams. This may take a few minutes..."
  ClearErrors
  ExecWait '"$PLUGINSDIR\application-setup.exe" /S /D=$INSTDIR' $0
  ${If} ${Errors}
    MessageBox MB_ICONSTOP "The downloaded installer could not be started."
    SetErrorLevel 1
    Abort
  ${EndIf}
  ${If} $0 != 0
  ${AndIf} $0 != 3010
    MessageBox MB_ICONSTOP "Application installation failed (exit code $0)."
    SetErrorLevel 1
    Abort
  ${EndIf}
  ${If} $0 == 3010
    SetRebootFlag true
  ${EndIf}
  Delete "$PLUGINSDIR\application-setup.exe"
  DetailPrint "Installation complete."
SectionEnd
