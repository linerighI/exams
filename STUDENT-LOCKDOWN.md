# Student session protection

After a successful student login, the Windows shell becomes borderless, full-screen and topmost. Normal window closing is blocked while the student session is active. The foreground keyboard hook intercepts Windows keys, Alt+Tab/Esc/F4/Space, Ctrl+Esc, Ctrl+Shift+Esc, F5/F11/F12 and common browser shortcuts. The hook is removed on authorized logout or process disposal. No Explorer process, Windows policy or account setting is changed.

The backend blocks teacher login, account switching, hosting, pairing, discovery and native exports during a student session. The renderer cannot invoke the private native unlock operation. A saved session restores after reload or a process restart. Exit requires the owning teacher's password, verified by the teacher server; an unavailable teacher server must reconnect before this exit can succeed. Ten failed password attempts within one minute trigger rate limiting. No teacher password hash is copied to student devices.

Logging out does not submit an unfinished exam. Its saved attempt remains resumable. Windows shutdown and a fatal backend failure can close the application; a saved student session is restored on the next launch.

## Windows deployment requirements

A normal desktop process cannot guarantee that a student cannot leave it. Ctrl+Alt+Delete, administrator access, process termination, other monitors and operating-system recovery are outside this application's protection. Browser-only use does not provide the native keyboard or window restrictions. The automated test shell suppresses the global hook and full-screen changes to avoid locking the developer's desktop.

For supervised official exams, school IT must provision a dedicated standard student account on supported Windows Enterprise, Education or IoT editions. Combine the installed desktop application with managed shell, application and keyboard policies. Preserve a separate administrator recovery account and test the school's recovery procedure before deployment.

- [Shell Launcher](https://learn.microsoft.com/en-us/windows/configuration/shell-launcher/) can run a desktop application as the account's shell. It does not restrict other applications by itself; configure application restrictions separately.
- [Configure Shell Launcher](https://learn.microsoft.com/en-us/windows/configuration/shell-launcher/configure) describes deployment and account-specific configuration. Point it at the installed native application rather than a development command.
- [Keyboard Filter](https://learn.microsoft.com/en-us/windows/configuration/keyboard-filter/) supplies OS-level suppression of configured key combinations, including Ctrl+Alt+Delete, on supported editions. Enabling it requires administrator provisioning and a restart. Administrator exemptions, breakout keys, Safe Mode and Remote Desktop behavior must be considered in the deployment policy.

This repository does not silently enable these Windows features or replace the current user's shell. The application's current session protection has automated integration coverage; a managed school kiosk deployment and the real keyboard hook still need validation on the target exam machines.
