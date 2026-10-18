using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;

namespace Alshereqi.Desktop;

internal static class UpdateInstaller
{
    public static async Task Prepare(string data, string root, string file, string hash, bool testMode)
    {
        if (!System.Text.RegularExpressions.Regex.IsMatch(hash, "^[a-f0-9]{64}$")) throw new Exception("بصمة التحديث غير صالحة");
        var expected = Path.GetFullPath(Path.Combine(data, "updates", hash + ".exe"));
        if (!string.Equals(Path.GetFullPath(file), expected, StringComparison.OrdinalIgnoreCase) || !File.Exists(expected))
            throw new Exception("ملف التحديث خارج المجلد المسموح");
        await using (var input = File.OpenRead(expected))
            if (!Convert.ToHexString(await SHA256.HashDataAsync(input)).Equals(hash, StringComparison.OrdinalIgnoreCase))
                throw new Exception("فشل التحقق من التحديث");
        if (testMode) return; // Automation verifies the boundary without installing or closing the test app.
        var helper = Path.Combine(data, "updates", "install-after-exit.ps1");
        const string script = """
param([int]$AppPid, [string]$Installer, [string]$ExpectedHash, [string]$AppExe, [string]$InstallDir, [string]$ResultFile)
$ErrorActionPreference = 'Stop'
$env:PSModulePath = Join-Path $PSHOME 'Modules'
try { [Diagnostics.Process]::GetProcessById($AppPid).WaitForExit() } catch { }
try {
  if ((Get-FileHash -LiteralPath $Installer -Algorithm SHA256).Hash -ne $ExpectedHash) { throw 'Update checksum mismatch' }
  $installed = Start-Process -FilePath $Installer -ArgumentList @('/S', ('/D=' + $InstallDir)) -Verb RunAs -WindowStyle Hidden -Wait -PassThru
  if ($installed.ExitCode -ne 0 -and $installed.ExitCode -ne 3010) { throw ('Installer failed: ' + $installed.ExitCode) }
  @{ success = $true; exitCode = $installed.ExitCode } | ConvertTo-Json | Set-Content -LiteralPath $ResultFile -Encoding UTF8
} catch {
  @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json | Set-Content -LiteralPath $ResultFile -Encoding UTF8
}
Start-Process -FilePath $AppExe -WorkingDirectory $InstallDir
""";
        await File.WriteAllTextAsync(helper, script, new UTF8Encoding(false));
        var start = new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "WindowsPowerShell", "v1.0", "powershell.exe"))
        { UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden };
        foreach (var argument in new[] { "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", helper,
            "-AppPid", Environment.ProcessId.ToString(), "-Installer", expected, "-ExpectedHash", hash,
            "-AppExe", Environment.ProcessPath!, "-InstallDir", root, "-ResultFile", Path.Combine(data, "updates", "last-install.json") })
            start.ArgumentList.Add(argument);
        using var process = Process.Start(start) ?? throw new Exception("تعذر بدء تثبيت التحديث");
    }
}
