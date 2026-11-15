package jo.edu.alshereqi.schoolsync;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.HashSet;
import java.util.Set;

/**
 * Capacitor JS bridge exposing Android native OS notifications & live LAN background sync.
 */
@CapacitorPlugin(
        name = "SchoolSyncNotify",
        permissions = {
            @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
        }
)
public class SchoolSyncNotifyPlugin extends Plugin {
    @Override
    public void load() {
        SchoolSyncNotifier.ensureChannels(getContext());
    }

    @PluginMethod
    public void ensurePermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
                || getPermissionState("notifications") == PermissionState.GRANTED) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        requestPermissionForAlias("notifications", call, "permissionResult");
    }

    @PermissionCallback
    private void permissionResult(PluginCall call) {
        JSObject ret = new JSObject();
        boolean granted = SchoolSyncNotifier.hasPostPermission(getContext());
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void configure(PluginCall call) {
        Context ctx = getContext();
        String serverUrl = call.getString("serverUrl", "").replaceAll("/+$", "");
        String token = call.getString("token", "");
        JSArray seenArray = call.getArray("seenIds");

        SharedPreferences prefs = ctx.getSharedPreferences(SchoolSyncNotifier.PREFS, Context.MODE_PRIVATE);
        prefs.edit()
                .putString(SchoolSyncNotifier.KEY_SERVER, serverUrl)
                .putString(SchoolSyncNotifier.KEY_TOKEN, token)
                .apply();

        if (seenArray != null) {
            Set<String> ids = new HashSet<>();
            for (int i = 0; i < seenArray.length(); i++) {
                String v = seenArray.optString(i, "");
                if (!v.isEmpty()) ids.add(v);
            }
            SchoolSyncNotifier.markManySeen(ctx, ids);
        }

        if (!serverUrl.isEmpty() && !token.isEmpty() && SchoolSyncNotifier.hasPostPermission(ctx)) {
            Intent svc = new Intent(ctx, SchoolSyncLiveService.class);
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    ctx.startForegroundService(svc);
                } else {
                    ctx.startService(svc);
                }
            } catch (Exception ignored) {
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void showNotification(PluginCall call) {
        String id = call.getString("id", "");
        String title = call.getString("title", "مدرسة محمد الشريقي");
        String body = call.getString("body", "");
        boolean urgent = Boolean.TRUE.equals(call.getBoolean("urgent", false));
        SchoolSyncNotifier.postToPanel(getContext(), id, title, body, urgent);
        call.resolve();
    }

    @PluginMethod
    public void clearSession(PluginCall call) {
        Context ctx = getContext();
        ctx.getSharedPreferences(SchoolSyncNotifier.PREFS, Context.MODE_PRIVATE)
                .edit()
                .remove(SchoolSyncNotifier.KEY_TOKEN)
                .apply();
        try {
            ctx.stopService(new Intent(ctx, SchoolSyncLiveService.class));
        } catch (Exception ignored) {
        }
        call.resolve();
    }
}
