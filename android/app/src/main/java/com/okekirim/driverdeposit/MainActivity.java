package com.okekirim.driverdeposit;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import android.graphics.Color;
import androidx.appcompat.app.AppCompatDelegate;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Force light mode at Android level - app manages dark mode via CSS
        AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO);
        
        super.onCreate(savedInstanceState);
        createNotificationChannel();

        // Force WebView to NOT follow system dark mode - app manages its own theme
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.setBackgroundColor(Color.WHITE);
            // Disable WebView's automatic dark mode (force light rendering)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                webView.getSettings().setAlgorithmicDarkeningAllowed(false);
            } else if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                webView.getSettings().setForceDark(android.webkit.WebSettings.FORCE_DARK_OFF);
            }
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                "deposit_reminder",
                "Reminder Setoran",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Notifikasi pengingat setoran harian");
            channel.enableVibration(true);
            channel.setShowBadge(true);

            NotificationChannel adminChannel = new NotificationChannel(
                "admin_notifications",
                "Notifikasi Admin",
                NotificationManager.IMPORTANCE_HIGH
            );
            adminChannel.setDescription("Notifikasi setoran masuk dan orderan baru");
            adminChannel.enableVibration(true);
            adminChannel.setShowBadge(true);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
                manager.createNotificationChannel(adminChannel);
            }
        }
    }
}
