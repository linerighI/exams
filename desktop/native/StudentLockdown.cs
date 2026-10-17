using System.Runtime.InteropServices;

namespace Alshereqi.Desktop;

// Session-scoped kiosk restrictions. Windows secure attention (Ctrl+Alt+Delete),
// administrative process termination and OS policy require a managed kiosk account.
internal sealed class StudentLockdown : IDisposable
{
    private readonly Form owner;
    private readonly Hook callback;
    private nint hook;
    private Rectangle previousBounds;
    private FormWindowState previousState;
    private bool active;
    private delegate nint Hook(int code, nint message, nint data);
    public StudentLockdown(Form owner) { this.owner = owner; callback = Filter; }
    public void Enable()
    {
        if(active) return;
        hook=SetWindowsHookEx(13,callback,GetModuleHandle(null),0);
        if(hook==0) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), "تعذر تفعيل قيود جلسة الطالب");
        active=true;previousBounds=owner.Bounds;previousState=owner.WindowState;
        owner.WindowState=FormWindowState.Normal;
        owner.FormBorderStyle=FormBorderStyle.None;
        owner.Bounds=Screen.FromControl(owner).Bounds;
        owner.TopMost=true;
        owner.Activate();
    }
    private nint Filter(int code,nint message,nint data)
    {
        if(code>=0 && active && GetAncestor(GetForegroundWindow(),3)==owner.Handle)
        {
            int key=Marshal.ReadInt32(data);
            bool ctrl=(GetAsyncKeyState(0x11)&0x8000)!=0, alt=(GetAsyncKeyState(0x12)&0x8000)!=0;
            bool shift=(GetAsyncKeyState(0x10)&0x8000)!=0;
            if(key is 0x5B or 0x5C || (alt && (key is 0x09 or 0x1B or 0x73 or 0x20)) || (ctrl && key==0x1B) || (ctrl && shift && key==0x1B) || key is 0x74 or 0x7A or 0x7B || (ctrl && (key is 0x52 or 0x4E or 0x50 or 0x53 or 0x57 or 0x4C)))
                return 1;
        }
        return CallNextHookEx(hook,code,message,data);
    }
    public void Dispose()
    {
        if(hook!=0) {UnhookWindowsHookEx(hook);hook=0;}
        if(!active)return;active=false;
        owner.TopMost=false;owner.FormBorderStyle=FormBorderStyle.Sizable;
        owner.Bounds=previousBounds;owner.WindowState=previousState;
    }
    [DllImport("user32.dll",SetLastError=true)]private static extern nint SetWindowsHookEx(int kind,Hook proc,nint module,uint thread);
    [DllImport("user32.dll")]private static extern bool UnhookWindowsHookEx(nint hook);
    [DllImport("user32.dll")]private static extern nint CallNextHookEx(nint hook,int code,nint message,nint data);
    [DllImport("user32.dll")]private static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")]private static extern nint GetForegroundWindow();
    [DllImport("user32.dll")]private static extern nint GetAncestor(nint window,uint flags);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode)]private static extern nint GetModuleHandle(string? name);
}
