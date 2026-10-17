Unicode True
!include "MUI2.nsh"
!include "x64.nsh"
!include "LogicLib.nsh"
Name "Alshereqi Exams WebView2"
OutFile "..\release\Alshereqi-Exams-WebView2-${APP_VERSION}-Setup.exe"
InstallDir "$PROGRAMFILES64\Alshereqi Exams WebView2"
RequestExecutionLevel admin
SetCompressor /SOLID lzma
!define MUI_ICON "..\build\icon.ico"
!define MUI_UNICON "..\build\icon.ico"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "This application requires Windows x64."
    Abort
  ${EndIf}
FunctionEnd
Section "Alshereqi Exams" SEC_APP
  SetOutPath "$INSTDIR"
  File /r "..\release\webview2-unpacked\*"
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
      MessageBox MB_ICONSTOP "WebView2 Runtime installation failed ($1). Install the included runtime and run setup again."
      Abort
    ${EndIf}
    ${If} $1 == 3010
      SetRebootFlag true
    ${EndIf}
  ${EndIf}
  SetRegView 64
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Alshereqi WebView2 TCP"'
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Alshereqi WebView2 Discovery"'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="Alshereqi WebView2 TCP" dir=in action=allow program="$INSTDIR\runtime\node.exe" protocol=TCP localport=4310 profile=private remoteip=localsubnet'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="Alshereqi WebView2 Discovery" dir=in action=allow program="$INSTDIR\runtime\node.exe" protocol=UDP localport=4311 profile=private remoteip=localsubnet'
  SetShellVarContext all
  CreateDirectory "$SMPROGRAMS\Alshereqi Exams WebView2"
  CreateShortcut "$SMPROGRAMS\Alshereqi Exams WebView2\Alshereqi Exams.lnk" "$INSTDIR\Alshereqi Exams.exe"
  CreateShortcut "$SMPROGRAMS\Alshereqi Exams WebView2\Graphics compatibility mode.lnk" "$INSTDIR\Alshereqi Exams.exe" "--software-rendering"
  CreateShortcut "$DESKTOP\Alshereqi Exams WebView2.lnk" "$INSTDIR\Alshereqi Exams.exe"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AlshereqiExamsWebView2" "DisplayName" "Alshereqi Exams WebView2"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AlshereqiExamsWebView2" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AlshereqiExamsWebView2" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AlshereqiExamsWebView2" "DisplayIcon" "$INSTDIR\Alshereqi Exams.exe"
SectionEnd
Section "Uninstall"
  SetRegView 64
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Alshereqi WebView2 TCP"'
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Alshereqi WebView2 Discovery"'
  SetShellVarContext all
  Delete "$DESKTOP\Alshereqi Exams WebView2.lnk"
  RMDir /r "$SMPROGRAMS\Alshereqi Exams WebView2"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AlshereqiExamsWebView2"
  ; Keep school databases and WebView2 profiles under LocalAppData.
  RMDir /r "$INSTDIR"
SectionEnd
