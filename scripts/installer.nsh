!macro customInstall
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Alshereqi Exams TCP"'
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Alshereqi Exams Discovery"'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="Alshereqi Exams TCP" dir=in action=allow program="$INSTDIR\Alshereqi Exams.exe" protocol=TCP localport=4310 profile=private remoteip=localsubnet'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="Alshereqi Exams Discovery" dir=in action=allow program="$INSTDIR\Alshereqi Exams.exe" protocol=UDP localport=4311 profile=private remoteip=localsubnet'
!macroend
!macro customUnInstall
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Alshereqi Exams TCP"'
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Alshereqi Exams Discovery"'
!macroend
