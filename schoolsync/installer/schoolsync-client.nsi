Unicode True
!include "MUI2.nsh"
!include "x64.nsh"
!include "LogicLib.nsh"

Name "SchoolSync Client"
OutFile "..\..\release\SchoolSync-Client-${APP_VERSION}-Setup.exe"
InstallDir "$PROGRAMFILES64\SchoolSync Client"
RequestExecutionLevel admin
SetCompressor /SOLID lzma

!define MUI_ICON "..\..\build\icon.ico"
!define MUI_UNICON "..\..\build\icon.ico"
!define MUI_FINISHPAGE_RUN "$INSTDIR\SchoolSync Client.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch SchoolSync now"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "This application requires 64-bit Windows (x64)."
    Abort
  ${EndIf}
FunctionEnd

Section "SchoolSync Client" SEC_APP
  nsExec::ExecToLog 'taskkill /IM "SchoolSync Client.exe" /T /F'
  Sleep 500

  SetOutPath "$INSTDIR"
  File /r "..\..\release\schoolsync-client-unpacked\*"

  SetRegView 32
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  ${If} $0 == ""
  ${OrIf} $0 == "0.0.0.0"
    ReadRegStr $0 HKCU "SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  ${EndIf}
  ${If} $0 == ""
  ${OrIf} $0 == "0.0.0.0"
    ExecWait '"$INSTDIR\runtime\WebView2Installer.exe" /silent /install' $1
    ${If} $1 != 0
    ${AndIf} $1 != 3010
      MessageBox MB_ICONSTOP "WebView2 Runtime installation failed ($1). Install Microsoft Edge WebView2 Runtime and run setup again."
      Abort
    ${EndIf}
    ${If} $1 == 3010
      SetRebootFlag true
    ${EndIf}
  ${EndIf}

  SetRegView 64
  SetShellVarContext all
  CreateDirectory "$SMPROGRAMS\SchoolSync"
  CreateShortcut "$SMPROGRAMS\SchoolSync\SchoolSync.lnk" "$INSTDIR\SchoolSync Client.exe"
  CreateShortcut "$SMPROGRAMS\SchoolSync\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\SchoolSync.lnk" "$INSTDIR\SchoolSync Client.exe"

  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SchoolSyncClient" "DisplayName" "SchoolSync"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SchoolSyncClient" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SchoolSyncClient" "Publisher" "Alshereqi School"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SchoolSyncClient" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SchoolSyncClient" "DisplayIcon" "$INSTDIR\SchoolSync Client.exe"
SectionEnd

Section "Uninstall"
  nsExec::ExecToLog 'taskkill /IM "SchoolSync Client.exe" /T /F'
  Sleep 500

  SetRegView 64
  SetShellVarContext all
  Delete "$DESKTOP\SchoolSync.lnk"
  RMDir /r "$SMPROGRAMS\SchoolSync"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SchoolSyncClient"
  RMDir /r "$INSTDIR"
SectionEnd
