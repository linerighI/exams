using System.Security.Cryptography;
using System.Text;
using System.Runtime.InteropServices;

namespace Alshereqi.Desktop;

internal static class Program
{
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    private static extern int SetCurrentProcessExplicitAppUserModelID(string appId);
    [STAThread]
    static int Main(string[] args)
    {
        Console.InputEncoding = new UTF8Encoding(false);
        Console.OutputEncoding = new UTF8Encoding(false);
        if (args.Length == 1 && args[0] is "--protect" or "--unprotect")
        {
            try
            {
                var input = Console.In.ReadToEnd();
                Console.Write(args[0] == "--protect"
                    ? Convert.ToBase64String(ProtectedData.Protect(Encoding.UTF8.GetBytes(input), null, DataProtectionScope.CurrentUser))
                    : Encoding.UTF8.GetString(ProtectedData.Unprotect(Convert.FromBase64String(input), null, DataProtectionScope.CurrentUser)));
                return 0;
            }
            catch { return 1; }
        }
        SetCurrentProcessExplicitAppUserModelID("school.alshereqi.exams.webview2");
        ApplicationConfiguration.Initialize();
        using var window = new MainWindow(args);
        Application.Run(window);
        return 0;
    }
}
