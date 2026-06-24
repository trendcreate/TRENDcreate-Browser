package com.trendcreate.browser

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

/**
 * Foreground service that keeps audio playback alive in the background and
 * shows a media notification with play/pause and stop controls.
 */
class AudioService : Service() {

    companion object {
        private const val CHANNEL = "audio_playback"
        private const val NOTIF_ID = 1001
        const val ACTION_TOGGLE = "com.trendcreate.browser.action.TOGGLE"
        const val ACTION_STOP = "com.trendcreate.browser.action.STOP"

        /** Start or refresh the foreground notification to match current state. */
        fun update(context: Context) {
            ContextCompat.startForegroundService(context, Intent(context, AudioService::class.java))
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, AudioService::class.java))
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_TOGGLE -> AudioController.playPause(this)
            ACTION_STOP -> {
                AudioController.stop(this)
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
        }
        if (!AudioController.hasTrack) {
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }
        startForeground(NOTIF_ID, buildNotification())
        return START_STICKY
    }

    private fun buildNotification(): Notification {
        createChannel()
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        val toggle = PendingIntent.getService(this, 1,
            Intent(this, AudioService::class.java).setAction(ACTION_TOGGLE), flags)
        val stop = PendingIntent.getService(this, 2,
            Intent(this, AudioService::class.java).setAction(ACTION_STOP), flags)
        val open = PendingIntent.getActivity(this, 0,
            Intent(this, MainActivity::class.java), flags)

        val playing = AudioController.isPlaying
        return NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_globe)
            .setContentTitle(AudioController.trackName)
            .setContentText("TRENDcreate Browser")
            .setContentIntent(open)
            .setOngoing(playing)
            .setOnlyAlertOnce(true)
            .addAction(
                if (playing) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play,
                if (playing) "一時停止" else "再生", toggle
            )
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "停止", stop)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build()
    }

    private fun createChannel() {
        val nm = getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(CHANNEL) == null) {
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL, "音楽再生", NotificationManager.IMPORTANCE_LOW)
            )
        }
    }
}
