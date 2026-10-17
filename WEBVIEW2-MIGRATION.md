# Windows WebView2 desktop

The desktop app uses a self-contained .NET 10 WinForms host, Microsoft WebView2, and a separate Node 24 backend. Electron and Electron Builder are no longer dependencies. The React screens, animations, school server, AI integrations, and offline worker remain in place.

## Run and test

```powershell
npm install
# Once, if the .NET 10 SDK is missing:
npm run desktop:setup
npm run desktop
# Optional GPU compatibility mode:
npm run desktop -- --software-rendering
```

`npm run desktop` builds the frontend/backend/native shell and opens the complete application. A previous development window is closed gracefully before its executable is replaced. Installed users need neither Node nor the .NET SDK. The window and taskbar use the school icon and a distinct Windows application identity.

The teacher starts the school server from the welcome screen. A fresh student clicks the login orb, chooses the discovered teacher computer, and enters the single connection code shown in the teacher's settings. The orb is red when disconnected, briefly green on connection, then blue. The connection is saved; subsequent sign-ins require only the student code. Manual IPv4 entry remains an advanced fallback. A code-derived HMAC challenge binds the observed certificate before the code is submitted over the pinned connection; students never type a fingerprint.

Fresh desktop data is stored in `%LOCALAPPDATA%\Alshereqi Exams WebView2`: `school` contains the SQLite databases and connection credentials; `WebView2` contains browser storage, including offline student attempts; `desktop.log` contains startup/backend diagnostics. Electron data is neither imported nor deleted.

## Architecture and security

- `window.desktop` keeps the existing methods, promises, and event subscriptions. The bridge is injected only into the trusted top-level `https://app.alshereqi.invalid` page. Only explicit desktop methods can cross the bridge.
- The backend owns teacher authorization, TLS certificate pinning, LAN discovery, school services, and OCR/AI orchestration. Standard input/output carry private JSON messages; diagnostics go to standard error.
- Native dialogs, PDF printing, external links, and current-user Windows DPAPI protection are implemented in C#. Credential helper processes receive secret input through pipes, never command-line arguments. No plaintext fallback is used.
- A Windows Job Object owns the backend and OCR descendants. Window exit, unexpected host exit, and backend failure release the processes. Native print views are created on demand and disposed after export.
- Remote debugging and fake dialogs are enabled only with the explicit test launch mode in Debug or a separately compiled automation shell. Release installer binaries ignore test/debug switches. Inspect, browser context menus, and browser accelerator shortcuts are disabled in all sessions, including development launches. Normal hardware acceleration is the default; software rendering is optional and retains all visuals.

## Distribution

```powershell
npm run worker:build
npm run dist
npm run test:packaged
```

Python 3.11/3.12 is needed only to build the existing PDF/OCR worker. Its executable and Arabic models are required by the distribution preflight. C++ development headers and temporary worker build trees are excluded from the installer.

The first distribution build downloads the full Microsoft-signed Evergreen WebView2 offline installer and a checksum-pinned NSIS compiler. The result is `release/Alshereqi-Exams-WebView2-1.4.3-Setup.exe`; the standalone published app is in `release/webview2-unpacked`. The installer contains the .NET runtime, Node runtime, production modules, PDF/OCR runtime/models, and WebView2 installer, which is run only if WebView2 is missing. Installer firewall rules permit the bundled backend on private local networks only. Uninstall preserves school data.

Ollama and its language models remain separate, as before. Cloud AI requires its existing internet connection and credentials. The `electron-to-chromium` entry in the development lockfile is browser-compatibility metadata used by frontend build tools; it does not install Electron.

## Verification

Commands: `npm test`, `npm run test:ui`, `npm run test:desktop:all`, and `npm run test:packaged`.

Checks cover exam permissions, concurrent students, answers/results, backup/restore, PDF source rendering, bank imports, teacher/student UI, browser offline save/resume, native teacher setup/login, PDF export, GeoGebra, discovery/pairing, wrong certificate pins, DPAPI credentials, native dialog cancellation, frame isolation, software rendering, occupied ports, backend crashes, and cleanup. A scanned PDF was also processed successfully by the frozen OCR executable with local models.

Physical camera hardware, live paid cloud AI calls, and a clean Windows machine with no WebView2 installation are not covered by these automated checks. Windows Sandbox is unavailable on this development host; the missing-runtime installer branch still requires a clean-PC or VM acceptance run. No system WebView2 installation was removed to simulate that condition.

## Initial performance sample

One local run per engine used the same visible animated welcome screen, a five-second warmup, and a five-second animation sample. The final WebView2 sample used a visibly labeled temporary test window. Debugging was enabled. Totals below include app, browser, backend, and console-host processes only; unrelated command/compiler processes were excluded. These are indicative samples, not a controlled target-machine benchmark.

| Metric | Electron | WebView2 |
|---|---:|---:|
| Launch to welcome screen | 2.20 s | 2.38 s |
| App process private memory | 372 MiB | 320 MiB |
| Summed app process working sets | 466 MiB | 528 MiB |
| Sampled GPU 3D engine utilization | 3.43% | 2.89% |
| Mean animation-frame interval | 5.57 ms | 5.56 ms |

Private memory decreased in this sample; working sets and launch time increased. GPU activity was similar. CPU comparisons were excluded after the initial process-tree collector picked up an unrelated compiler through a recycled parent PID; the collector now checks process creation dates. This does not establish an improvement on the school's weaker GPUs. Test the normal and software-rendering modes on those PCs before choosing a deployment default.

Raw measurements are in `test-results/electron-benchmark.json` and `test-results/webview2-benchmark.json`. Run `npm run benchmark:desktop` for a new WebView2 sample. An optional legacy comparison requires a separate executable through `LEGACY_ELECTRON_EXE` and a legacy app through `LEGACY_ELECTRON_APP`; Electron is not reinstalled by the benchmark.
