using System.Runtime.InteropServices;
using System.Text;

namespace SchoolSync.Desktop;

internal static class Program
{
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    private static extern int SetCurrentProcessExplicitAppUserModelID(string appId);

    [STAThread]
    private static int Main(string[] args)
    {
        Console.InputEncoding = new UTF8Encoding(false);
        Console.OutputEncoding = new UTF8Encoding(false);
        SetCurrentProcessExplicitAppUserModelID("jo.edu.alshereqi.schoolsync.server");

        var suffix = Environment.GetEnvironmentVariable("SCHOOLSYNC_INSTANCE_SUFFIX") ?? string.Empty;
        using var singleInstanceMutex = new Mutex(true, $"Local\\SchoolSyncServerConsole_SingleInstance{suffix}", out bool createdNew);
        using var showWindowEvent = new EventWaitHandle(false, EventResetMode.AutoReset, $"Local\\SchoolSyncServerConsole_ShowWindow{suffix}");

        bool backgroundLaunch = args.Contains("--background") || args.Contains("--minimized");
        if (!createdNew)
        {
            if (!backgroundLaunch)
            {
                try { showWindowEvent.Set(); } catch { }
            }
            return 0;
        }

        ApplicationConfiguration.Initialize();
        using var window = new ServerWindow(args, showWindowEvent);
        Application.Run(window);
        return 0;
    }
}
