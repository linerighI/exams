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
    private readonly SemaphoreSlim writer = new(1, 1);
    private readonly SemaphoreSlim dialogs = new(1, 1);
    private readonly HashSet<string> commands = new(StringComparer.Ordinal)
    { "host", "discover", "pair", "connection-state", "connect-teacher", "student-session", "request", "backup-save", "backup-read", "export-csv", "model-download", "ollama-download-page", "ai-provider-page", "bank-pdf", "teacher-resource", "speech-status", "speech-transcribe", "speech-synthesize" };
    private Process? backend;
    private ProcessJob? job;
    private CoreWebView2Environment? environment;
    private long nextId;
    private bool closing, stopped;
    private bool studentMode;
    private bool teacherSpeechSession;
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
                    browserArguments += " --use-fake-device-for-media-stream --use-fake-ui-for-media-stream";
                int index = Array.IndexOf(arguments, "--debug-port");
                if (index >= 0 && index + 1 < arguments.Length && int.TryParse(arguments[index + 1], out int port) && port is > 1024 and < 65536)
                    browserArguments += $" --remote-debugging-port={port} --remote-debugging-address=127.0.0.1";
            }
            // Do not inherit debugging switches from the launching environment.
            Environment.SetEnvironmentVariable("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", null);
            environment = await CoreWebView2Environment.CreateAsync(null, Path.Combine(data, "WebView2"), new CoreWebView2EnvironmentOptions(browserArguments));
            await view.EnsureCoreWebView2Async(environment);
            var core = view.CoreWebView2;
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
                e.State = Trusted(e.Uri) && (e.PermissionKind == CoreWebView2PermissionKind.Camera ||
                    (e.PermissionKind == CoreWebView2PermissionKind.Microphone && teacherSpeechSession && !studentMode))
                    ? CoreWebView2PermissionState.Allow : CoreWebView2PermissionState.Deny;
            };
            core.WebMessageReceived += OnWebMessage;
            await core.AddScriptToExecuteOnDocumentCreatedAsync(await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory, "bridge.js")));
            StartBackend();
            await ready.Task.WaitAsync(TimeSpan.FromSeconds(30));
            core.Navigate(Origin + "/index.html");
        }
        catch (Exception error)
        {
            Log(error.ToString());
            if (!testMode) MessageBox.Show(this, "تعذر تشغيل التطبيق. تحقق من تثبيت WebView2 Runtime.\n\n" + error.Message, "Alshereqi Exams", MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
        }
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
            if (!closing && !IsDisposed) BeginInvoke(() => { Log(error.Message); if (!testMode) MessageBox.Show(this, "توقف خادم المدرسة. أعد تشغيل التطبيق.\n" + error.Message); studentMode=false; Close(); });
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
            return await completion.Task.WaitAsync(TimeSpan.FromMinutes(method == "model-download" ? 61 : 10));
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
                if(enabled && !testMode) {lockdown ??= new StudentLockdown(this);lockdown.Enable();}
                if(!enabled) {lockdown?.Dispose();lockdown=null;}
                studentMode=enabled;
                if(testMode) Console.Error.WriteLine("Student session locked: " + enabled.ToString().ToLowerInvariant());
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
                return await core.PrintToPdfAsync(Path.GetFullPath(filename), settings);
            }
            finally { try { File.Delete(document); } catch { } }
        }
        finally { Controls.Remove(print); }
    }
    private async void OnClosing(object? sender, FormClosingEventArgs e)
    {
        if(studentMode && !closing && !testMode && e.CloseReason != CloseReason.WindowsShutDown) {e.Cancel=true;return;}
        if (stopped) return;
        e.Cancel = true;
        if (closing) return;
        closing = true;
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
            Close();
        }
    }
}
