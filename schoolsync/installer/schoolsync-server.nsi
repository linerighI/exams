Unicode True
!include "MUI2.nsh"
!include "x64.nsh"
!include "LogicLib.nsh"

Name "SchoolSync Server"
OutFile "..\..\release\SchoolSync-Server-${APP_VERSION}-Setup.exe"
InstallDir "$PROGRAMFILES64\SchoolSync Server"
RequestExecutionLevel admin
SetCompressor /SOLID lzma

!define MUI_ICON "..\..\build\icon.ico"
!define MUI_UNICON "..\..\build\icon.ico"
!define MUI_FINISHPAGE_RUN "$INSTDIR\SchoolSync Server.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch SchoolSync Server Console now"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_COMPONENTS
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

Section "SchoolSync Server (Core)" SEC_CORE
  SectionIn RO
  nsExec::ExecToLog 'taskkill /IM "SchoolSync Server.exe" /T /F'
  Sleep 500

  SetOutPath "$INSTDIR"
  File /r "..\..\release\schoolsync-server-unpacked\*"

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
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="SchoolSync Server TCP 4320"'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="SchoolSync Server TCP 4320" dir=in action=allow program="$INSTDIR\runtime\node.exe" protocol=TCP localport=4320 profile=private'

  SetShellVarContext all
  CreateDirectory "$SMPROGRAMS\SchoolSync Server"
  CreateShortcut "$SMPROGRAMS\SchoolSync Server\SchoolSync Server.lnk" "$INSTDIR\SchoolSync Server.exe"
  CreateShortcut "$SMPROGRAMS\SchoolSync Server\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\SchoolSync Server.lnk" "$INSTDIR\SchoolSync Server.exe"

  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SchoolSyncServer" "DisplayName" "SchoolSync Server"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SchoolSyncServer" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SchoolSyncServer" "Publisher" "Alshereqi School"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SchoolSyncServer" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SchoolSyncServer" "DisplayIcon" "$INSTDIR\SchoolSync Server.exe"
SectionEnd

Section "Start automatically with Windows (background tray)" SEC_AUTOSTART
  SetRegView 64
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "SchoolSyncServer" '"$INSTDIR\SchoolSync Server.exe" --background'
SectionEnd

LangString DESC_SEC_CORE ${LANG_ENGLISH} "Installs SchoolSync Server Console, local database engine, and bundled Cloudflare Tunnel runtime."
LangString DESC_SEC_AUTOSTART ${LANG_ENGLISH} "Automatically starts SchoolSync Server and Cloudflare Tunnel silently in the system tray when Windows boots."

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_CORE} $(DESC_SEC_CORE)
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_AUTOSTART} $(DESC_SEC_AUTOSTART)
!insertmacro MUI_FUNCTION_DESCRIPTION_END

Section "Uninstall"
  nsExec::ExecToLog 'taskkill /IM "SchoolSync Server.exe" /T /F'
  Sleep 500

  SetRegView 64
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "SchoolSyncServer"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "SchoolSyncServer"
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="SchoolSync Server TCP 4320"'

  SetShellVarContext all
  Delete "$DESKTOP\SchoolSync Server.lnk"
  RMDir /r "$SMPROGRAMS\SchoolSync Server"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SchoolSyncServer"
  ; Keep user database, backups, and console configuration under %LocalAppData%\SchoolSync Server\data.
  RMDir /r "$INSTDIR"
SectionEnd
