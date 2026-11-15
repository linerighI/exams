package jo.edu.alshereqi.schoolsync;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Lightweight LAN SSE listener delivering instant Android notification-shade alerts
 * even while SchoolSync is minimized or the phone screen is locked.
 */
public class SchoolSyncLiveService extends Service {
    private volatile boolean running = false;
    private Thread worker;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        SchoolSyncNotifier.ensureChannels(this);
        if (!SchoolSyncNotifier.hasPostPermission(this)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        startForegroundStatus();
        if (!running) {
            running = true;
            worker = new Thread(this::listenLoop, "SchoolSync-LiveNotify");
            worker.start();
        }
        return START_STICKY;
    }

    private void startForegroundStatus() {
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(
                this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Notification n = new NotificationCompat.Builder(this, SchoolSyncNotifier.CHANNEL_SERVICE)
                .setSmallIcon(getApplicationInfo().icon)
                .setContentTitle("مدرسة محمد الشريقي")
                .setContentText("متصل لاستقبال التنبيهات الفورية")
                .setPriority(NotificationCompat.PRIORITY_MIN)
                .setSilent(true)
                .setOngoing(true)
                .setContentIntent(pi)
                .build();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(
                        SchoolSyncNotifier.SERVICE_NOTIF_ID,
                        n,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING
                );
            } else {
                startForeground(SchoolSyncNotifier.SERVICE_NOTIF_ID, n);
            }
        } catch (Exception ignored) {
        }
    }

    private void listenLoop() {
        while (running) {
            SharedPreferences prefs = getSharedPreferences(SchoolSyncNotifier.PREFS, MODE_PRIVATE);
            String server = prefs.getString(SchoolSyncNotifier.KEY_SERVER, "");
            String token = prefs.getString(SchoolSyncNotifier.KEY_TOKEN, "");
            if (server == null || server.isEmpty() || token == null || token.isEmpty()) {
                sleepQuietly(3000);
                continue;
            }
            fetchPending(server, token);
            openStream(server, token);
            sleepQuietly(3500);
        }
    }

    private void fetchPending(String server, String token) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(server + "/api/notifications/pending");
            conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(8000);
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("ngrok-skip-browser-warning", "true");
            if (conn.getResponseCode() == 200) {
                BufferedReader br = new BufferedReader(
                        new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8)
                );
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) sb.append(line);
                JSONObject json = new JSONObject(sb.toString());
                JSONArray items = json.optJSONArray("notifications");
                if (items != null) {
                    for (int i = items.length() - 1; i >= 0; i--) {
                        JSONObject item = items.getJSONObject(i);
                        String title = item.optString("title", "");
                        boolean urgent = title.contains("غياب") || title.contains("تأخر");
                        SchoolSyncNotifier.postToPanel(
                                this,
                                item.optString("id", ""),
                                title,
                                item.optString("content", ""),
                                urgent
                        );
                    }
                }
            }
        } catch (Exception ignored) {
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private void openStream(String server, String token) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(server + "/api/notifications/stream");
            conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(45000);
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("Accept", "text/event-stream");
            conn.setRequestProperty("ngrok-skip-browser-warning", "true");
            if (conn.getResponseCode() != 200) return;

            BufferedReader br = new BufferedReader(
                    new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8)
            );
            String line;
            while (running && (line = br.readLine()) != null) {
                if (!line.startsWith("data:")) continue;
                String jsonStr = line.substring(5).trim();
                if (jsonStr.isEmpty()) continue;
                JSONObject item = new JSONObject(jsonStr);
                String title = item.optString("title", "");
                boolean urgent = item.optBoolean("urgent", title.contains("غياب") || title.contains("تأخر"));
                SchoolSyncNotifier.postToPanel(
                        this,
                        item.optString("id", ""),
                        title,
                        item.optString("content", ""),
                        urgent
                );
            }
        } catch (Exception ignored) {
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private void sleepQuietly(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException ignored) {
        }
    }

    @Override
    public void onDestroy() {
        running = false;
        if (worker != null) worker.interrupt();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
