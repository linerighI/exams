package jo.edu.alshereqi.schoolsync;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import java.util.HashSet;
import java.util.Set;

/**
 * Shared native Android OS notification-shade helper & deduplication registry.
 */
final class SchoolSyncNotifier {
    static final String PREFS = "schoolsync_notify";
    static final String KEY_SERVER = "server_url";
    static final String KEY_TOKEN = "auth_token";
    static final String KEY_SEEN = "seen_ids";
    static final String CHANNEL_ALERTS = "schoolsync_alerts";
    static final String CHANNEL_URGENT = "schoolsync_urgent";
    static final String CHANNEL_SERVICE = "schoolsync_service";
    static final int SERVICE_NOTIF_ID = 9001;

    private SchoolSyncNotifier() {}

    static boolean hasPostPermission(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true;
        return ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
    }

    static void ensureChannels(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager mgr = ctx.getSystemService(NotificationManager.class);
        if (mgr == null) return;

        NotificationChannel alerts = new NotificationChannel(
                CHANNEL_ALERTS,
                "تنبيهات المدرسة",
                NotificationManager.IMPORTANCE_HIGH
        );
        alerts.setDescription("التعاميم والواجبات والملاحظات الفورية");
        alerts.enableLights(true);
        alerts.setLightColor(Color.parseColor("#286BE8"));

        NotificationChannel urgent = new NotificationChannel(
                CHANNEL_URGENT,
                "تنبيهات الغياب العاجلة",
                NotificationManager.IMPORTANCE_HIGH
        );
        urgent.setDescription("تنبيهات الغياب والتأخر الفورية");
        urgent.enableLights(true);
        urgent.enableVibration(true);
        urgent.setLightColor(Color.parseColor("#D6455D"));

        NotificationChannel svc = new NotificationChannel(
                CHANNEL_SERVICE,
                "خدمة التزامن المباشر",
                NotificationManager.IMPORTANCE_MIN
        );
        svc.setShowBadge(false);

        mgr.createNotificationChannel(alerts);
        mgr.createNotificationChannel(urgent);
        mgr.createNotificationChannel(svc);
    }

    static synchronized boolean markSeenIfNew(Context ctx, String id) {
        if (id == null || id.isEmpty()) return true;
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        Set<String> current = new HashSet<>(prefs.getStringSet(KEY_SEEN, new HashSet<>()));
        if (current.contains(id)) return false;
        if (current.size() > 200) current.clear();
        current.add(id);
        prefs.edit().putStringSet(KEY_SEEN, current).apply();
        return true;
    }

    static void markManySeen(Context ctx, Set<String> ids) {
        if (ids == null || ids.isEmpty()) return;
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        Set<String> current = new HashSet<>(prefs.getStringSet(KEY_SEEN, new HashSet<>()));
        current.addAll(ids);
        if (current.size() > 250) {
            Set<String> trimmed = new HashSet<>();
            int i = 0;
            for (String item : current) {
                if (i++ >= 200) break;
                trimmed.add(item);
            }
            current = trimmed;
        }
        prefs.edit().putStringSet(KEY_SEEN, current).apply();
    }

    static void postToPanel(Context ctx, String id, String title, String body, boolean urgent) {
        ensureChannels(ctx);
        if (!hasPostPermission(ctx)) return;
        if (!markSeenIfNew(ctx, id)) return;

        Intent openIntent = new Intent(ctx, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        openIntent.putExtra("schoolsync_tab", "alerts");

        PendingIntent pending = PendingIntent.getActivity(
                ctx,
                Math.abs(id != null ? id.hashCode() : (int) System.currentTimeMillis()),
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String channel = urgent ? CHANNEL_URGENT : CHANNEL_ALERTS;
        NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, channel)
                .setSmallIcon(ctx.getApplicationInfo().icon)
                .setContentTitle(title != null && !title.isEmpty() ? title : "مدرسة محمد الشريقي")
                .setContentText(body != null ? body : "")
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body != null ? body : ""))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setColor(Color.parseColor(urgent ? "#D6455D" : "#286BE8"))
                .setAutoCancel(true)
                .setContentIntent(pending);

        int notifId = id != null && !id.isEmpty()
                ? Math.abs(id.hashCode())
                : (int) (System.currentTimeMillis() & 0x7fffffff);
        try {
            NotificationManagerCompat.from(ctx).notify(notifId, builder.build());
        } catch (SecurityException ignored) {
        }
    }
}
