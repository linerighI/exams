using System.Diagnostics;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace SchoolSync.Desktop;

internal sealed class ServerWindow : Form
{
    private readonly WebView2 view = new()
    {
        Dock = DockStyle.Fill,
        DefaultBackgroundColor = Color.FromArgb(238, 244, 252),
    };
    private readonly Panel loadingPanel = new()
    {
        Dock = DockStyle.Fill,
        BackColor = Color.FromArgb(11, 17, 29),
    };
    private readonly Label loadingLabel = new()
    {
        Dock = DockStyle.Fill,
        TextAlign = ContentAlignment.MiddleCenter,
        ForeColor = Color.FromArgb(203, 213, 225),
        Font = new Font("Segoe UI", 12),
        Text = "جارٍ تشغيل لوحة خادم سكول سينك والنفق السحابي…",
    };

    private readonly NotifyIcon trayIcon;
    private readonly EventWaitHandle showWindowEvent;
    private readonly ManualResetEventSlim exitWaitEvent = new(false);
    private readonly int consolePort;
    private readonly string consoleUrl;
    private readonly string repoRoot;
    private readonly string daemonScript;
    private readonly StringBuilder daemonErrors = new();
    private readonly Task daemonReadyTask;

    private Process? daemon;
    private ProcessJob? job;
    private bool allowVisible;
    private bool webViewInitializing;
    private bool webViewInitialized;
    private bool shownTrayTip;
    private bool forceExit;
    private bool shuttingDown;
    private bool shutdownDone;

    public ServerWindow(string[] args, EventWaitHandle showEvent)
    {
        showWindowEvent = showEvent;
        bool startInBackground = args.Contains("--background") || args.Contains("--minimized");
        allowVisible = !startInBackground;

        consolePort = int.TryParse(Environment.GetEnvironmentVariable("SCHOOLSYNC_CONSOLE_PORT"), out int p) && p is >= 1024 and <= 65535 ? p : 4325;
        consoleUrl = $"http://127.0.0.1:{consolePort}";
        (repoRoot, daemonScript) = ResolveDaemonPaths();

        Text = "SchoolSync Server Console — لوحة خادم سكول سينك";
        Width = 1320;
        Height = 880;
        MinimumSize = new Size(920, 640);
        if (startInBackground)
        {
            ShowInTaskbar = false;
            WindowState = FormWindowState.Minimized;
        }

        Icon? appIcon = null;
        try { appIcon = Icon.ExtractAssociatedIcon(Environment.ProcessPath!); } catch { }
        if (appIcon is not null) Icon = appIcon;

        Controls.Add(view);
        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 4 };
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 42));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 58));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 42));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 58));
        layout.Controls.Add(new Label
        {
            Dock = DockStyle.Fill,
            Text = "SchoolSync Server",
            TextAlign = ContentAlignment.MiddleCenter,
            ForeColor = Color.White,
            Font = new Font("Segoe UI", 28, FontStyle.Bold),
        }, 0, 1);
        layout.Controls.Add(loadingLabel, 0, 2);
        loadingPanel.Controls.Add(layout);
        Controls.Add(loadingPanel);
        loadingPanel.BringToFront();

        trayIcon = BuildTrayIcon(appIcon ?? SystemIcons.Application);

        StartDaemon();
        daemonReadyTask = WaitForDaemonHealthAsync();
        StartWakeListener();

        if (!startInBackground)
        {
            Shown += async (_, _) => await EnsureWebViewLoadedAsync();
        }
        FormClosing += OnClosing;
    }

    protected override void SetVisibleCore(bool value)
    {
        if (!allowVisible)
        {
            if (!IsHandleCreated) CreateHandle();
            value = false;
        }
        base.SetVisibleCore(value);
    }

    private NotifyIcon BuildTrayIcon(Icon icon)
    {
        var menu = new ContextMenuStrip();
        var openItem = new ToolStripMenuItem("فتح لوحة التحكم (Open Console)")
        {
            Font = new Font("Segoe UI", 9, FontStyle.Bold),
        };
        openItem.Click += (_, _) => ShowConsoleWindow();

        var portalItem = new ToolStripMenuItem("فتح بوابة المدرسة (Open Portal)");
        portalItem.Click += async (_, _) => await OpenPortalInBrowserAsync();

        var rotateItem = new ToolStripMenuItem("تجديد رابط Cloudflare (Rotate URL)");
        rotateItem.Click += async (_, _) => await RotateTunnelAsync();

        var quitItem = new ToolStripMenuItem("إغلاق الخادم والخروج نهائياً (Stop & Quit)");
        quitItem.Click += (_, _) =>
        {
            forceExit = true;
            Close();
        };

        menu.Items.Add(openItem);
        menu.Items.Add(portalItem);
        menu.Items.Add(rotateItem);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(quitItem);

        var notify = new NotifyIcon
        {
            Icon = icon,
            Text = "SchoolSync Server — الخادم والنفق نشطان",
            ContextMenuStrip = menu,
            Visible = true,
        };
        notify.DoubleClick += (_, _) => ShowConsoleWindow();
        return notify;
    }

    private void StartWakeListener()
    {
        var thread = new Thread(() =>
        {
            var handles = new WaitHandle[] { showWindowEvent, exitWaitEvent.WaitHandle };
            while (!shuttingDown)
            {
                int signaled = WaitHandle.WaitAny(handles);
                if (signaled == 1 || shuttingDown) break;
                try
                {
                    if (IsHandleCreated && !IsDisposed)
                    {
                        BeginInvoke(ShowConsoleWindow);
                    }
                }
                catch { }
            }
        })
        {
            IsBackground = true,
            Name = "SchoolSyncTrayWakeListener",
        };
        thread.Start();
    }

    private void ShowConsoleWindow()
    {
        if (shuttingDown) return;
        allowVisible = true;
        ShowInTaskbar = true;
        Show();
        if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
        Activate();
        BringToFront();
        _ = EnsureWebViewLoadedAsync();
    }

    private static (string root, string script) ResolveDaemonPaths()
    {
        var envRoot = Environment.GetEnvironmentVariable("SCHOOLSYNC_APP_ROOT");
        if (!string.IsNullOrWhiteSpace(envRoot))
        {
            var candidate = Path.Combine(envRoot, "schoolsync", "server", "console-daemon.cjs");
            if (File.Exists(candidate)) return (Path.GetFullPath(envRoot), candidate);
        }

        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            var candidate = Path.Combine(dir.FullName, "schoolsync", "server", "console-daemon.cjs");
            if (File.Exists(candidate)) return (dir.FullName, candidate);
            var localCandidate = Path.Combine(dir.FullName, "server", "console-daemon.cjs");
            if (File.Exists(localCandidate) && dir.Parent is not null) return (dir.Parent.FullName, localCandidate);
            dir = dir.Parent;
        }

        throw new FileNotFoundException("تعذر العثور على schoolsync/server/console-daemon.cjs.");
    }

    private static string ResolveNodeExecutable(string root)
    {
        var fromEnv = Environment.GetEnvironmentVariable("SCHOOLSYNC_NODE_EXECUTABLE");
        if (!string.IsNullOrWhiteSpace(fromEnv) && File.Exists(fromEnv)) return fromEnv;
        var bundled = Path.Combine(AppContext.BaseDirectory, "runtime", "node.exe");
        if (File.Exists(bundled)) return bundled;
        var rootBundled = Path.Combine(root, "runtime", "node.exe");
        if (File.Exists(rootBundled)) return rootBundled;
        return "node";
    }

    private void StartDaemon()
    {
        job = new ProcessJob();
        var nodeExe = ResolveNodeExecutable(repoRoot);
        bool isPackaged = File.Exists(Path.Combine(AppContext.BaseDirectory, "runtime", "node.exe"));

        var psi = new ProcessStartInfo
        {
            FileName = nodeExe,
            WorkingDirectory = repoRoot,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };
        psi.ArgumentList.Add(daemonScript);
        psi.ArgumentList.Add("--auto-start");
        psi.Environment["SCHOOLSYNC_CONSOLE_PORT"] = consolePort.ToString();
        psi.Environment["SCHOOLSYNC_APP_ROOT"] = repoRoot;
        psi.Environment["SCHOOLSYNC_NODE_EXECUTABLE"] = nodeExe;
        if (!string.IsNullOrWhiteSpace(Environment.ProcessPath))
        {
            psi.Environment["SCHOOLSYNC_SERVER_EXE"] = Environment.ProcessPath;
        }

        var envDataDir = Environment.GetEnvironmentVariable("SCHOOLSYNC_DATA_DIR");
        if (string.IsNullOrWhiteSpace(envDataDir) && isPackaged)
        {
            envDataDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "SchoolSync Server",
                "data"
            );
        }
        if (!string.IsNullOrWhiteSpace(envDataDir))
        {
            Directory.CreateDirectory(envDataDir);
            psi.Environment["SCHOOLSYNC_DATA_DIR"] = envDataDir;
            if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("SCHOOLSYNC_DB")))
            {
                psi.Environment["SCHOOLSYNC_DB"] = Path.Combine(envDataDir, "schoolsync-live.sqlite");
            }
        }

        var bundledCloudflared = Path.Combine(AppContext.BaseDirectory, "runtime", "cloudflared.exe");
        if (File.Exists(bundledCloudflared) && string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("CLOUDFLARED_PATH")))
        {
            psi.Environment["CLOUDFLARED_PATH"] = bundledCloudflared;
        }

        daemon = Process.Start(psi) ?? throw new InvalidOperationException("Failed to start Node console daemon.");
        job.Add(daemon);
        daemon.OutputDataReceived += (_, _) => { };
        daemon.ErrorDataReceived += (_, e) =>
        {
            if (!string.IsNullOrWhiteSpace(e.Data) && daemonErrors.Length < 2000)
            {
                lock (daemonErrors) { daemonErrors.AppendLine(e.Data); }
            }
        };
        daemon.BeginOutputReadLine();
        daemon.BeginErrorReadLine();
    }

    private async Task WaitForDaemonHealthAsync()
    {
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
        var deadline = DateTime.UtcNow.AddSeconds(30);
        while (DateTime.UtcNow < deadline && !shuttingDown)
        {
            if (daemon is { HasExited: true })
            {
                string errText;
                lock (daemonErrors) { errText = daemonErrors.ToString().Trim(); }
                throw new InvalidOperationException($"توقفت خدمة لوحة التحكم مبكراً.\n{errText}");
            }
            try
            {
                using var res = await http.GetAsync($"{consoleUrl}/api/console/health");
                if (res.IsSuccessStatusCode) return;
            }
            catch { }
            await Task.Delay(250);
        }
        throw new TimeoutException("انتهت مهلة انتظار تشغيل خدمة لوحة الخادم.");
    }

    private async Task EnsureWebViewLoadedAsync()
    {
        if (webViewInitialized || webViewInitializing || shuttingDown) return;
        webViewInitializing = true;
        try
        {
            var userData = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "SchoolSync Server WebView2"
            );
            Directory.CreateDirectory(userData);

            var env = await CoreWebView2Environment.CreateAsync(null, userData);
            await view.EnsureCoreWebView2Async(env);
            var core = view.CoreWebView2;
            core.Settings.IsStatusBarEnabled = false;
            core.NewWindowRequested += (_, e) =>
            {
                e.Handled = true;
                if (Uri.TryCreate(e.Uri, UriKind.Absolute, out var uri) &&
                    (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
                {
                    try { Process.Start(new ProcessStartInfo(uri.ToString()) { UseShellExecute = true }); } catch { }
                }
            };
            core.NavigationCompleted += (_, e) =>
            {
                if (e.IsSuccess) loadingPanel.Visible = false;
            };

            await daemonReadyTask;
            if (shuttingDown) return;

            webViewInitialized = true;
            core.Navigate(consoleUrl);
        }
        catch (Exception ex)
        {
            if (shuttingDown) return;
            MessageBox.Show(
                this,
                $"تعذر تشغيل لوحة خادم سكول سينك:\n{ex.Message}",
                "SchoolSync Server",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
            forceExit = true;
            Close();
        }
        finally
        {
            webViewInitializing = false;
        }
    }

    private async Task OpenPortalInBrowserAsync()
    {
        string target = "http://127.0.0.1:4320";
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
            var json = await http.GetStringAsync($"{consoleUrl}/api/console/status");
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("server", out var srv) &&
                srv.TryGetProperty("localUrl", out var urlEl) &&
                urlEl.GetString() is string localUrl &&
                !string.IsNullOrWhiteSpace(localUrl))
            {
                target = localUrl;
            }
        }
        catch { }
        try { Process.Start(new ProcessStartInfo(target) { UseShellExecute = true }); } catch { }
    }

    private async Task RotateTunnelAsync()
    {
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
            await http.PostAsync($"{consoleUrl}/api/console/tunnel/restart", new StringContent("{}", Encoding.UTF8, "application/json"));
            trayIcon.ShowBalloonTip(2500, "SchoolSync Server", "جارٍ إنشاء رابط Cloudflare جديد ومزامنته مع GitHub…", ToolTipIcon.Info);
        }
        catch { }
    }

    private async void OnClosing(object? sender, FormClosingEventArgs e)
    {
        if (shutdownDone) return;
        if (!forceExit && e.CloseReason == CloseReason.UserClosing)
        {
            e.Cancel = true;
            Hide();
            ShowInTaskbar = false;
            if (!shownTrayTip)
            {
                shownTrayTip = true;
                trayIcon.ShowBalloonTip(
                    3000,
                    "SchoolSync Server",
                    "خادم سكول سينك والنفق السحابي ما زالا يعملان في الخلفية. للإيقاف النهائي اختر إغلاق من أيقونة شريط المهام.",
                    ToolTipIcon.Info
                );
            }
            return;
        }

        e.Cancel = true;
        if (shuttingDown) return;
        shuttingDown = true;
        Hide();
        trayIcon.Visible = false;
        exitWaitEvent.Set();

        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
            using var _ = await http.PostAsync($"{consoleUrl}/api/console/shutdown", new StringContent("{}", Encoding.UTF8, "application/json"));
        }
        catch { }

        try
        {
            if (daemon is { HasExited: false })
            {
                daemon.Kill(entireProcessTree: true);
                daemon.WaitForExit(1500);
            }
        }
        catch { }
        finally
        {
            trayIcon.Dispose();
            job?.Dispose();
            daemon?.Dispose();
            exitWaitEvent.Dispose();
        }

        shutdownDone = true;
        Close();
    }
}
