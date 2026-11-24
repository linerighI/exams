using System.Runtime.InteropServices;
using System.Text;

namespace SchoolSync.Desktop;

internal static class Program
{
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    private static extern int SetCurrentProcessExplicitAppUserModelID(string appId);

    [STAThread]
    private static int Main()
    {
        Console.InputEncoding = new UTF8Encoding(false);
        Console.OutputEncoding = new UTF8Encoding(false);
        SetCurrentProcessExplicitAppUserModelID("jo.edu.alshereqi.schoolsync.client");
        ApplicationConfiguration.Initialize();
        using var window = new ClientWindow();
        Application.Run(window);
        return 0;
    }
}
