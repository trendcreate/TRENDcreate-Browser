package com.trendcreate.browser

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.provider.OpenableColumns
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

/**
 * Process-wide audio playback state. Lives outside the Compose tree and the
 * Activity so playback survives navigating away from the home screen and the
 * app being backgrounded. A foreground [AudioService] keeps the process alive
 * and shows the playback notification.
 */
object AudioController {
    private var player: MediaPlayer? = null

    var trackName by mutableStateOf("トラック未読み込み"); private set
    var isPlaying by mutableStateOf(false); private set
    var hasTrack by mutableStateOf(false); private set
    var volume by mutableFloatStateOf(0.8f); private set

    fun load(context: Context, uri: Uri) {
        val app = context.applicationContext
        player?.release()
        player = null
        isPlaying = false
        try {
            val mp = MediaPlayer()
            mp.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build()
            )
            mp.setDataSource(app, uri)
            mp.setOnPreparedListener { it.setVolume(volume, volume) }
            mp.setOnCompletionListener {
                isPlaying = false
                AudioService.update(app)
            }
            mp.prepareAsync()
            player = mp
            trackName = displayName(app, uri) ?: "音声ファイル"
            hasTrack = true
        } catch (e: Exception) {
            trackName = "読み込みに失敗しました"
            hasTrack = false
        }
        AudioService.update(app)
    }

    fun playPause(context: Context) {
        val mp = player ?: return
        if (isPlaying) { mp.pause(); isPlaying = false }
        else { mp.start(); isPlaying = true }
        AudioService.update(context.applicationContext)
    }

    fun changeVolume(v: Float) {
        volume = v
        player?.setVolume(v, v)
    }

    fun stop(context: Context) {
        player?.let { if (it.isPlaying) it.pause() }
        isPlaying = false
        AudioService.stop(context.applicationContext)
    }
}

private fun displayName(context: Context, uri: Uri): String? = try {
    context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use {
        if (it.moveToFirst()) it.getString(0) else null
    }
} catch (e: Exception) { null }
