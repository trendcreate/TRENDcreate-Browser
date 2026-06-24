package com.trendcreate.browser

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import kotlin.math.cos
import kotlin.math.sin

private val HBg = Color(0xFF0E0F13)
private val HCard = Color(0xCC1B1E26)
private val HAccent = Color(0xFF8AB4F8)
private val HText = Color(0xFFE8EAED)
private val HMuted = Color(0xFF9AA0A6)

@Composable
fun HomeScreen(
    onSearch: (String) -> Unit,
    onAiSearch: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier
            .fillMaxSize()
            .background(HBg)
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(Modifier.height(28.dp))
        AnalogClock(Modifier.size(150.dp))
        Spacer(Modifier.height(18.dp))
        DateText()
        Spacer(Modifier.height(6.dp))
        Text("TRENDcreate Browser", color = HMuted, fontSize = 16.sp, letterSpacing = 2.sp)
        Spacer(Modifier.height(32.dp))
        SearchBox(onSearch, onAiSearch)
        Spacer(Modifier.height(28.dp))
        AudioPlayerCard()
        Spacer(Modifier.height(40.dp))
    }
}

@Composable
private fun DateText() {
    var now by remember { mutableStateOf(Calendar.getInstance().time) }
    LaunchedEffect(Unit) {
        while (true) { now = Calendar.getInstance().time; delay(30_000) }
    }
    val fmt = remember { SimpleDateFormat("EEE, MMMM d, yyyy", Locale.ENGLISH) }
    Text(fmt.format(now), color = HText, fontSize = 26.sp, fontWeight = FontWeight.Light)
}

@Composable
private fun AnalogClock(modifier: Modifier) {
    var cal by remember { mutableStateOf(Calendar.getInstance()) }
    LaunchedEffect(Unit) {
        while (true) { cal = Calendar.getInstance(); delay(1000) }
    }
    val h = cal.get(Calendar.HOUR)
    val m = cal.get(Calendar.MINUTE)
    val s = cal.get(Calendar.SECOND)

    Canvas(modifier) {
        val r = size.minDimension / 2f
        val c = Offset(size.width / 2f, size.height / 2f)
        drawCircle(color = Color(0x33FFFFFF), radius = r, center = c, style = Stroke(width = 2f))

        fun hand(fraction: Float, length: Float, width: Float, color: Color) {
            val angle = Math.toRadians((fraction * 360f - 90f).toDouble())
            val end = Offset(
                c.x + (length * r * cos(angle)).toFloat(),
                c.y + (length * r * sin(angle)).toFloat()
            )
            drawLine(color, c, end, strokeWidth = width, cap = StrokeCap.Round)
        }
        hand((h + m / 60f) / 12f, 0.5f, 6f, HText)
        hand(m / 60f, 0.72f, 4f, HText)
        hand(s / 60f, 0.82f, 2f, HAccent)
        drawCircle(color = HAccent, radius = 6f, center = c)
    }
}

@Composable
private fun SearchBox(onSearch: (String) -> Unit, onAiSearch: (String) -> Unit) {
    var query by remember { mutableStateOf("") }
    Surface(
        color = HCard,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            BasicSearchField(
                value = query,
                onValueChange = { query = it },
                onGo = { if (query.isNotBlank()) onSearch(query) },
                modifier = Modifier.weight(1f)
            )
            TextButton(onClick = { if (query.isNotBlank()) onAiSearch(query) }) {
                Text("AI検索", color = HAccent, fontSize = 13.sp)
            }
            Button(
                onClick = { if (query.isNotBlank()) onSearch(query) },
                colors = ButtonDefaults.buttonColors(containerColor = HAccent),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp)
            ) { Text("検索", color = Color(0xFF0B0C10), fontSize = 13.sp) }
        }
    }
}

@Composable
private fun BasicSearchField(
    value: String,
    onValueChange: (String) -> Unit,
    onGo: () -> Unit,
    modifier: Modifier
) {
    TextField(
        value = value,
        onValueChange = onValueChange,
        singleLine = true,
        placeholder = { Text("Google で検索", color = HMuted, fontSize = 15.sp) },
        colors = TextFieldDefaults.colors(
            focusedContainerColor = Color.Transparent,
            unfocusedContainerColor = Color.Transparent,
            focusedIndicatorColor = Color.Transparent,
            unfocusedIndicatorColor = Color.Transparent,
            focusedTextColor = HText, unfocusedTextColor = HText
        ),
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
        keyboardActions = KeyboardActions(onSearch = { onGo() }),
        modifier = modifier
    )
}

@Composable
private fun AudioPlayerCard() {
    val context = LocalContext.current
    var pendingPlay by remember { mutableStateOf(false) }

    val notifPermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) {
        // Playback works regardless; without the permission only the
        // notification is hidden. Proceed with the queued play action.
        if (pendingPlay) { AudioController.playPause(context); pendingPlay = false }
    }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        if (uri != null) AudioController.load(context, uri)
    }

    fun togglePlay() {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            pendingPlay = true
            notifPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            AudioController.playPause(context)
        }
    }

    Surface(color = HCard, shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            OutlinedButton(
                onClick = { picker.launch(arrayOf("audio/*")) },
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Filled.MusicNote, null, tint = HAccent, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text("音楽読み込み (MP3/WAV/M4A)", color = HText, fontSize = 14.sp)
            }
            Spacer(Modifier.height(16.dp))
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                FilledIconButton(
                    onClick = { togglePlay() },
                    colors = IconButtonDefaults.filledIconButtonColors(containerColor = HAccent)
                ) {
                    Icon(
                        if (AudioController.isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                        "再生/一時停止", tint = Color(0xFF0B0C10)
                    )
                }
                Text(
                    AudioController.trackName, color = HMuted, fontSize = 13.sp,
                    maxLines = 1,
                    modifier = Modifier.padding(horizontal = 12.dp).weight(1f)
                )
            }
            Spacer(Modifier.height(8.dp))
            Slider(
                value = AudioController.volume,
                onValueChange = { AudioController.changeVolume(it) },
                colors = SliderDefaults.colors(thumbColor = HAccent, activeTrackColor = HAccent)
            )
        }
    }
}
