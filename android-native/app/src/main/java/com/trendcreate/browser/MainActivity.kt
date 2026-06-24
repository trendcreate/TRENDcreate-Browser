package com.trendcreate.browser

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.lazy.LazyColumn
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
import androidx.compose.ui.platform.LocalContext
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
private val Ultra = Color(0xFFF6A96B)
private val TextColor = Color(0xFFE8EAED)
private val Muted = Color(0xFF9AA0A6)

private enum class Overlay { NONE, BOOKMARKS, HISTORY }

class MainActivity : ComponentActivity() {
    private val pendingUrl = mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        pendingUrl.value = intent?.takeIf { it.action == Intent.ACTION_VIEW }?.dataString
        setContent {
            MaterialTheme(colorScheme = darkColorScheme(primary = Accent, background = BgColor, surface = SurfaceColor)) {
                BrowserScreen(pendingUrl)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent.action == Intent.ACTION_VIEW) pendingUrl.value = intent.dataString
    }
}

@Composable
fun BrowserScreen(pendingUrl: MutableState<String?>, vm: BrowserViewModel = viewModel()) {
    val active = vm.activeTab
    var overlay by remember { mutableStateOf(Overlay.NONE) }
    var showClear by remember { mutableStateOf(false) }

    LaunchedEffect(pendingUrl.value) {
        val u = pendingUrl.value
        if (!u.isNullOrBlank()) {
            vm.openUrl(u, inNewTab = vm.tabs.size != 1)
            pendingUrl.value = null
        }
    }

    BackHandler(enabled = overlay != Overlay.NONE) { overlay = Overlay.NONE }
    BackHandler(enabled = overlay == Overlay.NONE && active?.canGoBack == true) { vm.back() }

    Box(Modifier.fillMaxSize().background(BgColor)) {
        Column(
            Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().imePadding()
        ) {
            TabStrip(vm)
            NavBar(vm, onOpenOverlay = { overlay = it }, onClearData = { showClear = true })
            if (vm.findVisible) FindBar(vm)
            if (active != null && active.progress in 1..99) {
                LinearProgressIndicator(
                    progress = { active.progress / 100f },
                    color = if (vm.ultraMode) Ultra else Accent,
                    trackColor = Color.Transparent,
                    modifier = Modifier.fillMaxWidth().height(2.dp)
                )
            }
            if (active != null && active.isHome) {
                HomeScreen(
                    onSearch = { vm.loadUrlOrSearch(it) },
                    onAiSearch = { vm.searchAi(it) },
                    modifier = Modifier.weight(1f).fillMaxWidth()
                )
            } else {
                GeckoHost(vm, Modifier.weight(1f).fillMaxWidth())
            }
        }

        when (overlay) {
            Overlay.BOOKMARKS -> ListOverlay(
                "ブックマーク", vm.bookmarks,
                onOpen = { vm.openUrl(it.url); overlay = Overlay.NONE },
                onDelete = { vm.removeBookmark(it) },
                onClose = { overlay = Overlay.NONE }
            )
            Overlay.HISTORY -> ListOverlay(
                "履歴", vm.history,
                onOpen = { vm.openUrl(it.url); overlay = Overlay.NONE },
                onDelete = { vm.removeHistory(it) },
                onClose = { overlay = Overlay.NONE }
            )
            Overlay.NONE -> {}
        }

        if (showClear) ClearDataDialog(vm, onDismiss = { showClear = false })
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
private fun NavBar(vm: BrowserViewModel, onOpenOverlay: (Overlay) -> Unit, onClearData: () -> Unit) {
    val active = vm.activeTab
    var editing by remember(active?.url, vm.activeIndex) {
        mutableStateOf(if (active?.isHome == true) "" else active?.url ?: "")
    }
    var menuOpen by remember { mutableStateOf(false) }
    val ctx = LocalContext.current

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
        Box {
            IconButton(onClick = { menuOpen = true }) {
                Icon(Icons.Filled.MoreVert, "メニュー", tint = TextColor)
            }
            DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                val bookmarked = vm.isBookmarked(active?.url)
                DropdownMenuItem(
                    leadingIcon = { Icon(if (bookmarked) Icons.Filled.Star else Icons.Filled.StarBorder, null, tint = Accent) },
                    text = { Text(if (bookmarked) "ブックマーク解除" else "ブックマークに追加") },
                    onClick = { vm.toggleBookmark(); menuOpen = false }
                )
                DropdownMenuItem(
                    leadingIcon = { Icon(Icons.Filled.Bookmarks, null) },
                    text = { Text("ブックマーク一覧") },
                    onClick = { onOpenOverlay(Overlay.BOOKMARKS); menuOpen = false }
                )
                DropdownMenuItem(
                    leadingIcon = { Icon(Icons.Filled.History, null) },
                    text = { Text("履歴") },
                    onClick = { onOpenOverlay(Overlay.HISTORY); menuOpen = false }
                )
                DropdownMenuItem(
                    leadingIcon = { Icon(Icons.Filled.Search, null) },
                    text = { Text("ページ内検索") },
                    onClick = { vm.openFind(); menuOpen = false }
                )
                DropdownMenuItem(
                    leadingIcon = { Icon(Icons.Filled.AddToHomeScreen, null) },
                    text = { Text("ホーム画面に追加") },
                    onClick = { vm.addToHomeScreen(ctx); menuOpen = false }
                )
                DropdownMenuItem(
                    leadingIcon = { Icon(Icons.Filled.DeleteSweep, null) },
                    text = { Text("閲覧データを削除") },
                    onClick = { onClearData(); menuOpen = false }
                )
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun LowDataButton(vm: BrowserViewModel) {
    val active = vm.lowDataActive || vm.ultraMode
    val icon = if (vm.ultraMode) Icons.Filled.FlashOn
    else if (active) Icons.Filled.DataSaverOn else Icons.Filled.DataSaverOff
    val tint = when {
        vm.ultraMode -> Ultra
        active -> Accent
        else -> Muted
    }
    Box(
        Modifier
            .size(48.dp)
            .combinedClickable(
                onClick = { vm.cycleLowData() },
                onLongClick = { vm.toggleUltra() }
            ),
        contentAlignment = Alignment.Center
    ) {
        Icon(icon, "低速モード(長押しで超低速)", tint = tint)
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
private fun ListOverlay(
    title: String,
    items: List<SiteItem>,
    onOpen: (SiteItem) -> Unit,
    onDelete: (SiteItem) -> Unit,
    onClose: () -> Unit
) {
    Column(
        Modifier.fillMaxSize().background(BgColor).statusBarsPadding().navigationBarsPadding()
    ) {
        Row(
            Modifier.fillMaxWidth().background(BarColor).padding(horizontal = 6.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onClose) { Icon(Icons.Filled.ArrowBack, "戻る", tint = TextColor) }
            Text(title, color = TextColor, fontSize = 18.sp, modifier = Modifier.padding(start = 8.dp))
        }
        if (items.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("項目がありません", color = Muted)
            }
        } else {
            LazyColumn(Modifier.fillMaxSize()) {
                items(items, key = { it.url + it.time }) { item ->
                    Row(
                        Modifier.fillMaxWidth().clickable { onOpen(item) }.padding(horizontal = 14.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(item.title.ifBlank { item.url }, color = TextColor, fontSize = 14.sp,
                                maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(item.url, color = Muted, fontSize = 11.sp,
                                maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        IconButton(onClick = { onDelete(item) }) {
                            Icon(Icons.Filled.Close, "削除", tint = Muted, modifier = Modifier.size(18.dp))
                        }
                    }
                    HorizontalDivider(color = Color(0xFF22252E))
                }
            }
        }
    }
}

@Composable
private fun ClearDataDialog(vm: BrowserViewModel, onDismiss: () -> Unit) {
    val ranges = listOf(
        "過去1時間" to 3600_000L,
        "過去24時間" to 86_400_000L,
        "過去7日間" to 604_800_000L,
        "すべて" to null
    )
    var rangeIdx by remember { mutableIntStateOf(1) }
    var hist by remember { mutableStateOf(true) }
    var cookies by remember { mutableStateOf(true) }
    var cache by remember { mutableStateOf(true) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = SurfaceColor,
        title = { Text("閲覧データを削除", color = TextColor) },
        text = {
            Column {
                Text("期間", color = Muted, fontSize = 12.sp)
                ranges.forEachIndexed { i, (label, _) ->
                    Row(Modifier.fillMaxWidth().clickable { rangeIdx = i }.padding(vertical = 2.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        RadioButton(selected = rangeIdx == i, onClick = { rangeIdx = i })
                        Text(label, color = TextColor, fontSize = 14.sp)
                    }
                }
                Spacer(Modifier.height(8.dp))
                CheckRow("履歴", hist) { hist = it }
                CheckRow("Cookie・サイトデータ", cookies) { cookies = it }
                CheckRow("キャッシュ", cache) { cache = it }
                Text(
                    "※ Cookie・キャッシュはエンジンの仕様上、期間指定に関わらず全期間が対象です。",
                    color = Muted, fontSize = 11.sp, modifier = Modifier.padding(top = 6.dp)
                )
            }
        },
        confirmButton = {
            TextButton(onClick = {
                vm.clearBrowsingData(ranges[rangeIdx].second, hist, cookies, cache)
                onDismiss()
            }) { Text("削除", color = Accent) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("キャンセル", color = Muted) } }
    )
}

@Composable
private fun CheckRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().clickable { onChange(!checked) }.padding(vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Checkbox(checked = checked, onCheckedChange = onChange)
        Text(label, color = TextColor, fontSize = 14.sp)
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
                // Required so the content actually receives input (clicks/typing)
                // when hosted inside a Compose AndroidView.
                session.setActive(true)
                session.setFocused(true)
                view.requestFocus()
            }
        }
    )
}
