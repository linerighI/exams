using System.Collections.Concurrent;
using System.Diagnostics;
using System.Text;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Alshereqi.Desktop;

internal sealed class MainWindow : Form
{
    private const string Origin = "https://app.alshereqi.invalid";
    private readonly WebView2 view = new() { Dock = DockStyle.Fill, DefaultBackgroundColor = Color.FromArgb(244, 248, 255) };
    private readonly string[] arguments;
    private readonly bool testMode;
    private readonly string root;
    private readonly string data;
    private readonly ConcurrentDictionary<long, TaskCompletionSource<JsonElement>> pending = new();
    private readonly TaskCompletionSource ready = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private readonly CancellationTokenSource startupCancellation = new();
    private readonly Panel startupPanel = new() { Dock = DockStyle.Fill, BackColor = Color.FromArgb(244, 248, 255) };
    private readonly Label startupStatus = new() { Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleCenter,
        ForeColor = Color.FromArgb(74, 109, 154), Font = new Font("Segoe UI", 13), Text = "جارٍ تجهيز التطبيق…" };
    private bool startupCompleted;
    private bool restartRequested;
    private string startupStage = "بدء التشغيل";
    private readonly SemaphoreSlim writer = new(1, 1);
    private readonly SemaphoreSlim dialogs = new(1, 1);
    private readonly HashSet<string> commands = new(StringComparer.Ordinal)
    { "host", "discover", "network-state", "network-preferences", "pair", "connection-state", "connect-teacher", "student-session", "request", "backup-save", "backup-read", "backup-folder", "restart-app", "export-csv", "spreadsheet-save", "model-download", "ollama-download-page", "ai-provider-page", "bank-pdf", "report-pdf", "teacher-resource", "speech-status", "speech-transcribe", "speech-synthesize", "update-state", "update-check", "update-download", "update-cancel", "update-install" };
    private Process? backend;
    private ProcessJob? job;
    private CoreWebView2Environment? environment;
    private long nextId;
    private bool closing, stopped;
    private bool studentMode;
    private bool teacherSpeechSession;
    private bool cameraConsent;
    private StudentLockdown? lockdown;

    public MainWindow(string[] args)
    {
        arguments = args;
#if DEBUG || DESKTOP_AUTOMATION
        testMode = args.Contains("--test-mode");
#else
        testMode = false;
#endif
        root = Path.GetFullPath(Environment.GetEnvironmentVariable("SCHOOL_APP_ROOT") ?? AppContext.BaseDirectory);
        data = testMode && Environment.GetEnvironmentVariable("SCHOOL_TEST_DATA") is string testData
            ? Path.GetFullPath(testData)
            : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Alshereqi Exams WebView2");
        Directory.CreateDirectory(data);
        Text = "مدرسة محمد الشريقي — الامتحانات الإلكترونية";
        Icon = Icon.ExtractAssociatedIcon(Environment.ProcessPath!);
        Width = 1440; Height = 940; MinimumSize = new Size(1000, 720);
        if (testMode) {
            int roleIndex = Array.IndexOf(args, "--demo-role");
            if (roleIndex >= 0 && roleIndex + 1 < args.Length && args[roleIndex + 1] is "teacher" or "student") {
                bool isStudentDemo = args[roleIndex + 1] == "student";
                Text = (isStudentDemo ? "تجربة الطالب" : "تجربة المعلم") + " — بيانات تجريبية · قفل سطح المكتب معطل";
                var area = Screen.PrimaryScreen?.WorkingArea ?? new Rectangle(0, 0, 1366, 768);
                int half = area.Width / 2;
                MinimumSize = new Size(600, 600);
                StartPosition = FormStartPosition.Manual;
                Bounds = new Rectangle(area.Left + (isStudentDemo ? half : 0), area.Top, isStudentDemo ? area.Width - half : half, area.Height);
            }
        }
        Controls.Add(view);
        startupPanel.BackColor = Color.FromArgb(8, 11, 16);
        startupStatus.ForeColor = Color.FromArgb(137, 158, 184);
        startupStatus.Font = new Font("Segoe UI", 11);
        var startupLayout = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 5 };
        startupLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 45));
        startupLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 80));
        startupLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 32));
        startupLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 44));
        startupLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 55));
        startupLayout.Controls.Add(new Label { Dock = DockStyle.Fill, Text = "Zunis", TextAlign = ContentAlignment.MiddleCenter, ForeColor = Color.FromArgb(235, 243, 251), Font = new Font("Segoe UI", 40, FontStyle.Bold) }, 0, 1);
        startupLayout.Controls.Add(new Label { Dock = DockStyle.Fill, Text = "حماية مساحة المدرسة", TextAlign = ContentAlignment.MiddleCenter, ForeColor = Color.FromArgb(99, 120, 146), Font = new Font("Segoe UI", 11) }, 0, 2);
        startupLayout.Controls.Add(startupStatus, 0, 3);
        startupPanel.Controls.Add(startupLayout);
        Controls.Add(startupPanel);
        startupPanel.BringToFront();
        if (testMode && Environment.GetEnvironmentVariable("SCHOOL_HEADLESS_TEST") == "1") { Opacity = 0; ShowInTaskbar = false; }
        Shown += async (_, _) => await Start();
        FormClosing += OnClosing;
    }

    private async Task Start()
    {
        try
        {
            var browserArguments = arguments.Contains("--software-rendering") ? "--disable-gpu" : "";
            if (testMode)
            {
                if (arguments.Contains("--fake-camera"))
                    browserArguments += " --use-fake-device-for-media-stream";
                int index = Array.IndexOf(arguments, "--debug-port");
                if (index >= 0 && index + 1 < arguments.Length && int.TryParse(arguments[index + 1], out int port) && port is > 1024 and < 65536)
                    browserArguments += $" --remote-debugging-port={port} --remote-debugging-address=127.0.0.1";
            }
            // Do not inherit debugging switches from the launching environment.
            Environment.SetEnvironmentVariable("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", null);
            StartupStatus("تهيئة نافذة التطبيق", "جارٍ تجهيز نافذة التطبيق…");
            environment = await CoreWebView2Environment.CreateAsync(null, Path.Combine(data, "WebView2"), new CoreWebView2EnvironmentOptions(browserArguments));
            await view.EnsureCoreWebView2Async(environment);
            var core = view.CoreWebView2;
            // Clear grants/denials saved by older builds that bypassed the consent UI.
            StartupStatus("تهيئة صلاحيات الكاميرا", "جارٍ تجهيز إعدادات التطبيق…");
            await core.Profile.SetPermissionStateAsync(CoreWebView2PermissionKind.Camera, Origin, CoreWebView2PermissionState.Default);
            core.SetVirtualHostNameToFolderMapping("app.alshereqi.invalid", Path.Combine(root, "dist"), CoreWebView2HostResourceAccessKind.DenyCors);
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.AreBrowserAcceleratorKeysEnabled = false;
            if (testMode) Console.Error.WriteLine("Browser security: " + JsonSerializer.Serialize(new {
                devTools = core.Settings.AreDevToolsEnabled,
                contextMenus = core.Settings.AreDefaultContextMenusEnabled,
                browserShortcuts = core.Settings.AreBrowserAcceleratorKeysEnabled
            }));
            core.Settings.IsStatusBarEnabled = false;
            core.NewWindowRequested += (_, e) => e.Handled = true;
            core.WindowCloseRequested += (_, _) => Close();
            core.NavigationStarting += (_, e) => { if (!Trusted(e.Uri)) e.Cancel = true; };
            core.PermissionRequested += (_, e) =>
            {
                e.SavesInProfile = false;
                if (Trusted(e.Uri) && e.PermissionKind == CoreWebView2PermissionKind.Camera)
                {
                    if (!cameraConsent)
                    {
                        cameraConsent = testMode
                            ? arguments.Contains("--fake-camera") && !arguments.Contains("--deny-camera")
                            : MessageBox.Show(this, "هل تسمح للتطبيق باستخدام الكاميرا؟\n\nيبدأ البث فقط بعد موافقتك على طلب المعلم. لا يُرسل صوت مع بث الكاميرا.", "السماح باستخدام الكاميرا", MessageBoxButtons.YesNo, MessageBoxIcon.Question, MessageBoxDefaultButton.Button2, MessageBoxOptions.RtlReading | MessageBoxOptions.RightAlign) == DialogResult.Yes;
                    }
                    e.State = cameraConsent ? CoreWebView2PermissionState.Allow : CoreWebView2PermissionState.Deny;
                    if (testMode) Console.Error.WriteLine("Camera permission requested: " + e.State);
                }
                else e.State = Trusted(e.Uri) && e.PermissionKind == CoreWebView2PermissionKind.Microphone && teacherSpeechSession && !studentMode
                    ? CoreWebView2PermissionState.Allow : CoreWebView2PermissionState.Deny;
            };
            core.WebMessageReceived += OnWebMessage;
            await core.AddScriptToExecuteOnDocumentCreatedAsync(await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory, "bridge.js")));
            // Show the local loading artwork while the existing backend starts; no second process or artificial wait.
            core.NavigationCompleted += (_, e) => {
                if (e.IsSuccess && view.Source?.AbsolutePath == "/boot.html") startupPanel.Visible = false;
            };
            if (File.Exists(Path.Combine(root, "dist", "boot.html"))) core.Navigate(Origin + "/boot.html");
            StartupStatus("بدء خدمة التطبيق", "جارٍ بدء خدمة التطبيق واستعادة الاتصال المحفوظ…");
            StartBackend();
            if (!await WaitForBackendReady()) { Close(); return; }
            if (closing) return;
            StartupStatus("فتح الواجهة", "جارٍ فتح مساحة المدرسة…");
            ulong appNavigationId = 0;
            core.NavigationStarting += (_, e) => { if (e.Uri == Origin + "/index.html") appNavigationId = e.NavigationId; };
            core.NavigationCompleted += (_, e) => {
                if (closing || e.NavigationId != appNavigationId) return;
                if (view.Source?.AbsolutePath != "/index.html") return;
                if (e.IsSuccess) {
                    startupCompleted = true;
                    if (studentMode && !testMode) { lockdown ??= new StudentLockdown(this); lockdown.Enable(); }
                    startupPanel.Visible = false;
                    Log("Startup complete");
                } else {
                    Log("Startup navigation failed: " + e.WebErrorStatus);
                    startupStatus.Text = "تعذر فتح واجهة التطبيق. تحقق من اكتمال التثبيت.";
                }
            };
            core.Navigate(Origin + "/index.html");
        }
        catch (OperationCanceledException) when (closing) { }
        catch (Exception error)
        {
            Log("Startup failed at " + startupStage + ": " + error);
            if (!closing && !testMode) MessageBox.Show(this,
                "تعذر تشغيل التطبيق أثناء: " + startupStage + ".\n\n" + error.Message,
                "Alshereqi Exams", MessageBoxButtons.OK, MessageBoxIcon.Error);
            if (!closing) Close();
        }
    }
    private void StartupStatus(string stage, string message) {
        startupStage = stage;
        startupStatus.Text = message;
        if (view.CoreWebView2 is { } core && view.Source?.AbsolutePath == "/boot.html")
            _ = core.ExecuteScriptAsync("window.dispatchEvent(new CustomEvent('school-startup-status',{detail:" + JsonSerializer.Serialize(message) + "}));");
        Log("Startup stage: " + stage);
    }
    private async Task<bool> WaitForBackendReady() {
        var warning = TimeSpan.FromSeconds(30);
        if (testMode && int.TryParse(Environment.GetEnvironmentVariable("SCHOOL_TEST_STARTUP_WARNING_MS"), out int milliseconds)
            && milliseconds is >= 100 and <= 30000) warning = TimeSpan.FromMilliseconds(milliseconds);
        var cancellation = startupCancellation.Token;
        if (await Task.WhenAny(ready.Task, Task.Delay(warning, cancellation)) != ready.Task) {
            cancellation.ThrowIfCancellationRequested();
            StartupStatus("استعادة خدمة التطبيق", "يستغرق بدء الخدمة وقتًا أطول من المعتاد. نتابع تجهيز التطبيق، يرجى الانتظار…");
            Log("Startup slow: continuing to wait for the existing backend; no restart");
        }
        while (!closing) {
            try {
                await ready.Task.WaitAsync(TimeSpan.FromSeconds(90), cancellation);
                return true;
            } catch (TimeoutException) {
                Log("Startup backend wait expired; retry is available without starting a second backend");
                if (testMode) throw;
                var retry = MessageBox.Show(this,
                    "خدمة التطبيق لم تصبح جاهزة بعد. قد يكون Windows مشغولًا بتهيئة الملفات أو استعادة الاتصال.\n\nاضغط إعادة المحاولة لمتابعة الانتظار داخل هذه النافذة، أو إلغاء للإغلاق. لن تُحذف بياناتك.",
                    "بدء تشغيل التطبيق", MessageBoxButtons.RetryCancel, MessageBoxIcon.Information);
                if (retry != DialogResult.Retry) return false;
            }
        }
        return false;
    }
    private static bool Trusted(string uri) => Uri.TryCreate(uri, UriKind.Absolute, out var parsed) && parsed.GetLeftPart(UriPartial.Authority) == Origin;
    private void Log(string message)
    {
        Console.Error.WriteLine(message);
        try { File.AppendAllText(Path.Combine(data, "desktop.log"), DateTime.UtcNow.ToString("O") + " " + message + Environment.NewLine); } catch { }
    }
    private void StartBackend()
    {
        string node = Path.Combine(root, "runtime", "node.exe");
        if (!File.Exists(node)) node = Environment.GetEnvironmentVariable("SCHOOL_NODE_EXECUTABLE") ?? throw new FileNotFoundException("Bundled Node runtime is missing");
        var options = new ProcessStartInfo(node)
        {
            UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = root,
            RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true,
            StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8, StandardInputEncoding = new UTF8Encoding(false),
        };
        options.ArgumentList.Add(Path.Combine(root, "desktop", "backend.cjs"));
        options.Environment["SCHOOL_DESKTOP_DATA_DIR"] = data;
        options.Environment["SCHOOL_APP_ROOT"] = root;
        options.Environment["SCHOOL_NATIVE_HOST"] = Environment.ProcessPath!;
        options.Environment["SCHOOL_TEST_MODE"] = testMode ? "1" : "0";
        options.Environment["NODE_ENV"] = Environment.GetEnvironmentVariable("SCHOOL_DEVELOPMENT") == "1" ? "development" : "production";
        if (!testMode) options.Environment.Remove("SCHOOL_TEST_PORT");
        backend = Process.Start(options) ?? throw new Exception("Backend failed to start");
        try { job = new ProcessJob(); job.Add(backend); }
        catch { backend.Kill(true); throw; }
        _ = ReadBackend();
        _ = Task.Run(async () => { while (await backend.StandardError.ReadLineAsync() is string line) Log(line); });
    }
    private async Task ReadBackend()
    {
        try
        {
            while (await backend!.StandardOutput.ReadLineAsync() is string line)
            {
                using var doc = JsonDocument.Parse(line);
                var message = doc.RootElement.Clone();
                if (message.TryGetProperty("nativeId", out _))
                {
                    BeginInvoke(async () => await NativeCall(message));
                }
                else if (message.TryGetProperty("event", out var eventName))
                {
                    if (eventName.GetString() == "ready") ready.TrySetResult();
                    else BeginInvoke(() => { if (!closing) view.CoreWebView2?.PostWebMessageAsJson(message.GetRawText()); });
                }
                else if (message.TryGetProperty("id", out var id) && pending.TryRemove(id.GetInt64(), out var completion))
                {
                    if (message.TryGetProperty("error", out var error)) completion.TrySetException(new Exception(error.GetString()));
                    else completion.TrySetResult(message.GetProperty("result").Clone());
                }
            }
            throw new Exception("The school backend stopped unexpectedly");
        }
        catch (Exception error)
        {
            ready.TrySetException(error);
            foreach (var item in pending.Values) item.TrySetException(error);
            if ((startupCompleted || ready.Task.IsCompletedSuccessfully) && !closing && !IsDisposed) BeginInvoke(() => { Log(error.Message); if (!testMode) MessageBox.Show(this, "توقف خادم المدرسة. أعد تشغيل التطبيق.\n" + error.Message); studentMode=false; Close(); });
        }
    }
    private async Task Send(object message)
    {
        await writer.WaitAsync();
        try { await backend!.StandardInput.WriteLineAsync(JsonSerializer.Serialize(message)); await backend.StandardInput.FlushAsync(); }
        finally { writer.Release(); }
    }
    private async Task<JsonElement> Call(string method, JsonElement[] args)
    {
        long id = Interlocked.Increment(ref nextId);
        var completion = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        pending[id] = completion;
        try
        {
            await Send(new { id, method, args });
            return await completion.Task.WaitAsync(TimeSpan.FromMinutes(method is "model-download" or "update-download" ? 61 : 10));
        }
        finally { pending.TryRemove(id, out _); }
    }
    private async void OnWebMessage(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        if (!Trusted(e.Source) || !Trusted(view.Source?.ToString() ?? "") || closing) return;
        long id = 0;
        try
        {
            using var doc = JsonDocument.Parse(e.WebMessageAsJson);
            id = doc.RootElement.GetProperty("id").GetInt64();
            string method = doc.RootElement.GetProperty("method").GetString()!;
            if (!commands.Contains(method)) throw new Exception("Unsupported desktop command");
            var args = doc.RootElement.GetProperty("args").EnumerateArray().Select(a => a.Clone()).ToArray();
            var result = await Call(method, args);
            if (!closing) view.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new { id, result }));
        }
        catch (Exception error) { if (!closing) view.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new { id, error = error.Message })); }
    }
    private async Task NativeCall(JsonElement message)
    {
        long nativeId = message.GetProperty("nativeId").GetInt64();
        try
        {
            await dialogs.WaitAsync();
            object? result;
            try { result = await NativeOperation(message.GetProperty("method").GetString()!, message.GetProperty("args")); }
            finally { dialogs.Release(); }
            await Send(new { nativeId, result });
        }
        catch (Exception error) { if (!closing) await Send(new { nativeId, error = error.Message }); }
    }
    private async Task<object?> NativeOperation(string method, JsonElement args)
    {
        string? testDirectory = testMode ? Environment.GetEnvironmentVariable("SCHOOL_TEST_SAVE_DIR") : null;
        bool cancelTest = testMode && Environment.GetEnvironmentVariable("SCHOOL_TEST_CANCEL_DIALOGS") == "1";
        switch (method)
        {
            case "install-update":
                if (studentMode) throw new Exception("تحديث الطالب متاح من إرسال المعلم فقط");
                await UpdateInstaller.Prepare(data, root, args[0].GetString()!, args[1].GetString()!, testMode);
                if (!testMode) _ = Task.Run(async () => { await Task.Delay(700); if (!IsDisposed) BeginInvoke(() => Close()); });
                return true;
            case "install-school-update":
                // Internal backend command; deliberately absent from the WebView command allowlist.
                if (!studentMode) throw new Exception("جلسة الطالب غير متاحة");
                await UpdateInstaller.Prepare(data, root, args[0].GetString()!, args[1].GetString()!, testMode);
                if (!testMode) { studentMode=false; lockdown?.Dispose(); lockdown=null;
                    _ = Task.Run(async () => { await Task.Delay(700); if (!IsDisposed) BeginInvoke(() => Close()); }); }
                return true;
            case "teacher-speech-session":
                teacherSpeechSession = args[0].GetBoolean();
                return true;
            case "speech-status":
                if (!teacherSpeechSession || studentMode) throw new Exception("الصوت متاح للمعلم فقط");
                return OfflineSpeech.Status(root);
            case "speech-transcribe":
                if (!teacherSpeechSession || studentMode) throw new Exception("الصوت متاح للمعلم فقط");
                return await Task.Run(() => OfflineSpeech.Transcribe(root,args[0].GetString()!,args[1].GetString()!));
            case "speech-synthesize":
                if (!teacherSpeechSession || studentMode) throw new Exception("الصوت متاح للمعلم فقط");
                return await Task.Run(() => OfflineSpeech.Speak(root,args[0].GetString()!,args[1].GetString()!));
            case "student-mode":
                bool enabled=args[0].GetBoolean();
                if (enabled != studentMode) cameraConsent = false;
                if(enabled && startupCompleted && !testMode) {lockdown ??= new StudentLockdown(this);lockdown.Enable();}
                if(!enabled) {lockdown?.Dispose();lockdown=null;}
                studentMode=enabled;
                if(testMode) Console.Error.WriteLine("Student session locked: " + enabled.ToString().ToLowerInvariant());
                return true;
            case "backup-folder":
                if (!teacherSpeechSession || studentMode) throw new Exception("المجلد متاح للمعلم فقط");
                if (testMode) return testDirectory;
                using (var folder = new FolderBrowserDialog { Description = "اختر مجلدًا خاصًا داخل OneDrive أو Google Drive", UseDescriptionForTitle = true })
                    return folder.ShowDialog(this) == DialogResult.OK ? folder.SelectedPath : null;
            case "restart-app":
                if (!teacherSpeechSession || studentMode) throw new Exception("إعادة التشغيل متاحة للمعلم فقط");
                if (testMode) return true;
                restartRequested = true;
                _ = Task.Run(async () => { await Task.Delay(500); if (!IsDisposed) BeginInvoke(() => Close()); });
                return true;
            case "save-dialog":
                string filename = Path.GetFileName(args[0].GetProperty("defaultPath").GetString()!);
                if (cancelTest) return new { canceled = true };
                if (testDirectory != null) { Directory.CreateDirectory(testDirectory); return new { canceled = false, filePath = Path.Combine(testDirectory, filename) }; }
                using (var dialog = new SaveFileDialog { FileName = filename, Filter = Filter(args[0]), RestoreDirectory = true })
                    return dialog.ShowDialog(this) == DialogResult.OK ? new { canceled = false, filePath = dialog.FileName } : (object)new { canceled = true };
            case "open-dialog":
                if (cancelTest) return new { canceled = true };
                if (testMode && Environment.GetEnvironmentVariable("SCHOOL_TEST_OPEN_FILE") is string openPath) return new { canceled = false, filePaths = new[] { openPath } };
                using (var dialog = new OpenFileDialog { Filter = Filter(args[0]), RestoreDirectory = true })
                    return dialog.ShowDialog(this) == DialogResult.OK ? new { canceled = false, filePaths = new[] { dialog.FileName } } : (object)new { canceled = true };
            case "confirm-dialog":
                if (testMode) return new { response = cancelTest ? 0 : 1 };
                return new { response = MessageBox.Show(this, args[0].GetProperty("message").GetString(), "استعادة النسخة الاحتياطية", MessageBoxButtons.OKCancel, MessageBoxIcon.Warning, MessageBoxDefaultButton.Button2) == DialogResult.OK ? 1 : 0 };
            case "open-external":
                string url = args[0].GetString()!;
                if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != "https") throw new Exception("Unsupported external URL");
                if (!testMode) Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
                return null;
            case "print-pdf":
                return await PrintPdf(args[0].GetString()!, args[1].GetString()!);
            default: throw new Exception("Unsupported native operation");
        }
    }
    private static string Filter(JsonElement options)
    {
        if (!options.TryGetProperty("filters", out var filters)) return "All files|*.*";
        return string.Join("|", filters.EnumerateArray().Select(f => f.GetProperty("name").GetString() + "|" + string.Join(";", f.GetProperty("extensions").EnumerateArray().Select(e => "*." + e.GetString()))));
    }
    private async Task<bool> PrintPdf(string html, string filename)
    {
        using var print = new WebView2 { Size = new Size(850, 1100), Location = new Point(-2000, -2000) };
        Controls.Add(print);
        try
        {
            await print.EnsureCoreWebView2Async(environment);
            var core = print.CoreWebView2;
            core.Settings.IsScriptEnabled = false;
            core.Settings.IsWebMessageEnabled = false;
            core.Settings.AreDevToolsEnabled = false;
            core.NewWindowRequested += (_, e) => e.Handled = true;
            core.PermissionRequested += (_, e) => e.State = CoreWebView2PermissionState.Deny;
            var loaded = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            core.NavigationCompleted += (_, e) => { if (e.IsSuccess) loaded.TrySetResult(); else loaded.TrySetException(new Exception("PDF document failed to load")); };
            // NavigateToString is limited to 2 MB; a temporary local HTML file supports full banks.
            string directory = Path.Combine(data, "print");
            Directory.CreateDirectory(directory);
            string document = Path.Combine(directory, Guid.NewGuid().ToString("N") + ".html");
            try
            {
                await File.WriteAllTextAsync(document, html, new UTF8Encoding(false));
                core.SetVirtualHostNameToFolderMapping("print.alshereqi.invalid", directory, CoreWebView2HostResourceAccessKind.Deny);
                core.Navigate("https://print.alshereqi.invalid/" + Path.GetFileName(document));
                await loaded.Task.WaitAsync(TimeSpan.FromSeconds(60));
                var deadline = DateTime.UtcNow.AddSeconds(30);
                while (await core.ExecuteScriptAsync("document.fonts.status === 'loaded' && Array.from(document.images).every(i => i.complete)") != "true")
                {
                    if (DateTime.UtcNow > deadline) throw new TimeoutException("PDF fonts or images did not finish loading");
                    await Task.Delay(100);
                }
                var settings = environment!.CreatePrintSettings();
                settings.ShouldPrintBackgrounds = true;
                settings.PageWidth = 210.0 / 25.4;
                settings.PageHeight = 297.0 / 25.4;
                settings.ShouldPrintHeaderAndFooter = false;
                if (!await core.PrintToPdfAsync(Path.GetFullPath(filename), settings))
                    throw new Exception("تعذر حفظ PDF. أغلق الملف إذا كان مفتوحًا وحاول مجددًا.");
                return true;
            }
            finally { try { File.Delete(document); } catch { } }
        }
        finally { Controls.Remove(print); }
    }
    private async void OnClosing(object? sender, FormClosingEventArgs e)
    {
        if(studentMode && startupCompleted && !closing && !testMode && e.CloseReason != CloseReason.WindowsShutDown) {e.Cancel=true;return;}
        if (stopped) return;
        e.Cancel = true;
        if (closing) return;
        closing = true;
        startupCancellation.Cancel();
        try
        {
            if (backend is { HasExited: false }) await Call("shutdown", []).WaitAsync(TimeSpan.FromSeconds(3));
        }
        catch { }
        finally
        {
            lockdown?.Dispose();
            job?.Dispose();
            if (backend is { HasExited: false }) backend.Kill(true);
            backend?.Dispose();
            view.Dispose();
            stopped = true;
            if (restartRequested) Process.Start(new ProcessStartInfo(Environment.ProcessPath!) { UseShellExecute = true, WorkingDirectory = root });
            Close();
        }
    }
}
