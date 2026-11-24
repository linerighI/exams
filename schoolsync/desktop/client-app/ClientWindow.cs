using System.Diagnostics;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace SchoolSync.Desktop;

internal sealed class ClientWindow : Form
{
    private const string VirtualHost = "app.schoolsync.invalid";
    private const string VirtualOrigin = $"https://{VirtualHost}";

    private readonly WebView2 view = new()
    {
        Dock = DockStyle.Fill,
        DefaultBackgroundColor = Color.FromArgb(244, 248, 255),
    };
    private readonly string distDir;

    public ClientWindow()
    {
        distDir = ResolveDistDir();
        Text = "مدرسة محمد الشريقي — سكول سينك";
        Width = 1280;
        Height = 840;
        MinimumSize = new Size(440, 640);
        try { Icon = Icon.ExtractAssociatedIcon(Environment.ProcessPath!); } catch { }

        Controls.Add(view);
        Shown += async (_, _) => await StartAsync();
    }

    private static string ResolveDistDir()
    {
        var envDist = Environment.GetEnvironmentVariable("SCHOOLSYNC_DIST_DIR");
        if (!string.IsNullOrWhiteSpace(envDist) && File.Exists(Path.Combine(envDist, "index.html")))
        {
            return Path.GetFullPath(envDist);
        }

        var besideExe = Path.Combine(AppContext.BaseDirectory, "dist");
        if (File.Exists(Path.Combine(besideExe, "index.html"))) return besideExe;

        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            var repoDist = Path.Combine(dir.FullName, "schoolsync", "dist");
            if (File.Exists(Path.Combine(repoDist, "index.html"))) return repoDist;
            var localDist = Path.Combine(dir.FullName, "dist");
            if (File.Exists(Path.Combine(localDist, "index.html"))) return localDist;
            dir = dir.Parent;
        }

        throw new DirectoryNotFoundException("تعذر العثور على مجلد واجهة التطبيق (schoolsync/dist). شغّل npm run schoolsync:build أولاً.");
    }

    private async Task StartAsync()
    {
        try
        {
            var userData = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "SchoolSync Client WebView2"
            );
            Directory.CreateDirectory(userData);

            var env = await CoreWebView2Environment.CreateAsync(null, userData);
            await view.EnsureCoreWebView2Async(env);
            var core = view.CoreWebView2;

            core.SetVirtualHostNameToFolderMapping(
                VirtualHost,
                distDir,
                CoreWebView2HostResourceAccessKind.Allow
            );
            await core.AddScriptToExecuteOnDocumentCreatedAsync("window.__SCHOOLSYNC_DESKTOP__ = true;");

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
            core.NavigationStarting += (_, e) =>
            {
                if (!IsAllowedUri(e.Uri)) e.Cancel = true;
            };

            core.Navigate($"{VirtualOrigin}/index.html");
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                this,
                $"تعذر تشغيل تطبيق سكول سينك:\n{ex.Message}",
                "SchoolSync Client",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
            Close();
        }
    }

    private static bool IsAllowedUri(string uri)
    {
        if (!Uri.TryCreate(uri, UriKind.Absolute, out var parsed)) return false;
        if (parsed.Host.Equals(VirtualHost, StringComparison.OrdinalIgnoreCase)) return true;
        return parsed.Host is "127.0.0.1" or "localhost";
    }
}
