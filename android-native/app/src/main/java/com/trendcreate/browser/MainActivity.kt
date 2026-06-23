package com.trendcreate.browser

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.viewmodel.compose.viewModel
import org.mozilla.geckoview.GeckoView

private val BgColor = Color(0xFF0E0F13)
private val BarColor = Color(0xFF15171D)
private val SurfaceColor = Color(0xFF1B1E26)
private val Accent = Color(0xFF8AB4F8)
private val TextColor = Color(0xFFE8EAED)
private val Muted = Color(0xFF9AA0A6)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = darkColorScheme(primary = Accent, background = BgColor, surface = SurfaceColor)) {
                BrowserScreen()
            }
        }
    }
}

@Composable
fun BrowserScreen(vm: BrowserViewModel = viewModel()) {
    val active = vm.activeTab

    BackHandler(enabled = active?.canGoBack == true) { vm.back() }

    Column(
        Modifier
            .fillMaxSize()
            .background(BgColor)
            .statusBarsPadding()
            .navigationBarsPadding()
            .imePadding()
    ) {
        TabStrip(vm)
        NavBar(vm)
        if (vm.findVisible) FindBar(vm)
        if (active != null && active.progress in 1..99) {
            LinearProgressIndicator(
                progress = { active.progress / 100f },
                color = Accent,
                trackColor = Color.Transparent,
                modifier = Modifier.fillMaxWidth().height(2.dp)
            )
        }
        GeckoHost(vm, Modifier.weight(1f).fillMaxWidth())
    }
}

@Composable
private fun TabStrip(vm: BrowserViewModel) {
    Row(
        Modifier.fillMaxWidth().background(Color.Black).padding(horizontal = 4.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        LazyRow(Modifier.weight(1f)) {
            items(vm.tabs, key = { it.id }) { tab ->
                val index = vm.tabs.indexOf(tab)
                val selected = index == vm.activeIndex
                Row(
                    Modifier
                        .padding(horizontal = 3.dp)
                        .background(if (selected) SurfaceColor else Color(0xFF101216), RoundedCornerShape(8.dp))
                        .widthIn(min = 110.dp, max = 180.dp)
                        .height(34.dp)
                        .padding(start = 10.dp, end = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        tab.title,
                        color = if (selected) TextColor else Muted,
                        fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f).clickable { vm.selectTab(index) }
                    )
                    IconButton(onClick = { vm.closeTab(index) }, modifier = Modifier.size(24.dp)) {
                        Icon(Icons.Filled.Close, "閉じる", tint = Muted, modifier = Modifier.size(14.dp))
                    }
                }
            }
        }
        IconButton(onClick = { vm.newTab() }) {
            Icon(Icons.Filled.Add, "新しいタブ", tint = TextColor)
        }
    }
}

@Composable
private fun NavBar(vm: BrowserViewModel) {
    val active = vm.activeTab
    var editing by remember(active?.url, vm.activeIndex) { mutableStateOf(active?.url ?: "") }

    Row(
        Modifier.fillMaxWidth().background(BarColor).padding(horizontal = 6.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconButton(onClick = { vm.back() }, enabled = active?.canGoBack == true) {
            Icon(Icons.Filled.ArrowBack, "戻る", tint = if (active?.canGoBack == true) TextColor else Muted)
        }
        IconButton(onClick = { vm.forward() }, enabled = active?.canGoForward == true) {
            Icon(Icons.Filled.ArrowForward, "進む", tint = if (active?.canGoForward == true) TextColor else Muted)
        }
        IconButton(onClick = { vm.reload() }) {
            Icon(Icons.Filled.Refresh, "再読み込み", tint = TextColor)
        }
        OutlinedTextField(
            value = editing,
            onValueChange = { editing = it },
            singleLine = true,
            placeholder = { Text("検索またはURLを入力", color = Muted, fontSize = 14.sp) },
            textStyle = androidx.compose.ui.text.TextStyle(color = TextColor, fontSize = 14.sp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Accent, unfocusedBorderColor = Color(0xFF2A2D36),
                focusedContainerColor = SurfaceColor, unfocusedContainerColor = SurfaceColor
            ),
            shape = RoundedCornerShape(20.dp),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Go),
            keyboardActions = KeyboardActions(onGo = { vm.loadUrlOrSearch(editing) }),
            modifier = Modifier.weight(1f).height(48.dp).padding(horizontal = 4.dp)
        )
        LowDataButton(vm)
        IconButton(onClick = { vm.openFind() }) {
            Icon(Icons.Filled.Search, "ページ内検索", tint = TextColor)
        }
    }
}

@Composable
private fun LowDataButton(vm: BrowserViewModel) {
    val active = vm.lowDataActive
    val icon = if (active) Icons.Filled.DataSaverOn else Icons.Filled.DataSaverOff
    val label = when (vm.lowDataMode) {
        LowData.OFF -> "低速モード: OFF"
        LowData.AUTO -> if (vm.slowNetwork) "低速モード: 自動(作動中)" else "低速モード: 自動"
        LowData.ON -> "低速モード: ON"
    }
    IconButton(onClick = { vm.cycleLowData() }) {
        Icon(icon, label, tint = if (active) Accent else Muted)
    }
}

@Composable
private fun FindBar(vm: BrowserViewModel) {
    Row(
        Modifier.fillMaxWidth().background(SurfaceColor).padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        OutlinedTextField(
            value = vm.findQuery,
            onValueChange = { vm.find(it, true) },
            singleLine = true,
            placeholder = { Text("ページ内を検索", color = Muted, fontSize = 13.sp) },
            textStyle = androidx.compose.ui.text.TextStyle(color = TextColor, fontSize = 13.sp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Accent, unfocusedBorderColor = Color(0xFF2A2D36),
                focusedContainerColor = BgColor, unfocusedContainerColor = BgColor
            ),
            modifier = Modifier.weight(1f).height(46.dp)
        )
        Text(
            if (vm.findTotal > 0) "${vm.findCurrent}/${vm.findTotal}" else "",
            color = Muted, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 8.dp)
        )
        IconButton(onClick = { vm.find(vm.findQuery, false) }) {
            Icon(Icons.Filled.KeyboardArrowUp, "前へ", tint = TextColor)
        }
        IconButton(onClick = { vm.find(vm.findQuery, true) }) {
            Icon(Icons.Filled.KeyboardArrowDown, "次へ", tint = TextColor)
        }
        IconButton(onClick = { vm.closeFind() }) {
            Icon(Icons.Filled.Close, "閉じる", tint = TextColor)
        }
    }
}

@Composable
private fun GeckoHost(vm: BrowserViewModel, modifier: Modifier) {
    val active = vm.activeTab
    AndroidView(
        modifier = modifier,
        factory = { ctx -> GeckoView(ctx) },
        update = { view ->
            val session = active?.session
            if (session != null && view.session !== session) {
                view.releaseSession()
                view.setSession(session)
            }
        }
    )
}
