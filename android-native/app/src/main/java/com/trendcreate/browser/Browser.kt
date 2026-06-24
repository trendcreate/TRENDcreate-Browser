package com.trendcreate.browser

import android.app.Application
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat
import androidx.lifecycle.AndroidViewModel
import org.mozilla.geckoview.GeckoRuntime
import org.mozilla.geckoview.GeckoSession
import org.mozilla.geckoview.GeckoSessionSettings
import org.mozilla.geckoview.StorageController
import org.mozilla.geckoview.WebExtension
import org.mozilla.geckoview.WebExtensionController

/** Low data mode states. AUTO follows the measured connection speed. */
enum class LowData { OFF, AUTO, ON }

/** Below this estimated downstream bandwidth the link is treated as slow. */
private const val SLOW_THRESHOLD_KBPS = 1500

/** Sentinel for a fresh tab that shows the native home screen (no web load). */
const val HOME_URL = "trendcreate:home"

/** Holds the single process-wide GeckoRuntime. */
object Engine {
    @Volatile private var runtime: GeckoRuntime? = null
    fun runtime(app: Application): GeckoRuntime =
        runtime ?: synchronized(this) {
            runtime ?: GeckoRuntime.create(app).also { runtime = it }
        }
}

/** A single browser tab backed by its own GeckoSession. */
class Tab(
    val id: Long,
    var session: GeckoSession,
    initialUrl: String
) {
    var url by mutableStateOf(initialUrl)
    var title by mutableStateOf("New Tab")
    var progress by mutableIntStateOf(0)
    var canGoBack by mutableStateOf(false)
    var canGoForward by mutableStateOf(false)
    var loading by mutableStateOf(false)
    var isHome by mutableStateOf(false)
}

class BrowserViewModel(app: Application) : AndroidViewModel(app) {

    private val runtime = Engine.runtime(app)
    private var nextId = 0L

    val tabs = mutableStateListOf<Tab>()
    var activeIndex by mutableIntStateOf(0)

    /** Find-in-page bar state. */
    var findVisible by mutableStateOf(false)
    var findQuery by mutableStateOf("")
    var findCurrent by mutableIntStateOf(0)
    var findTotal by mutableIntStateOf(0)

    val activeTab: Tab? get() = tabs.getOrNull(activeIndex)

    // --- Low data mode ---
    var lowDataMode by mutableStateOf(LowData.AUTO)
    var slowNetwork by mutableStateOf(false)
    var ultraMode by mutableStateOf(false)
    val lowDataActive: Boolean
        get() = when (lowDataMode) {
            LowData.ON -> true
            LowData.OFF -> false
            LowData.AUTO -> slowNetwork
        }

    private var lowExt: WebExtension? = null
    private var ultraExt: WebExtension? = null
    private val connectivity = app.getSystemService(ConnectivityManager::class.java)
    private val netCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) {
            val kbps = caps.linkDownstreamBandwidthKbps
            slowNetwork = kbps in 1 until SLOW_THRESHOLD_KBPS
            applyLowData()
        }
        override fun onLost(network: Network) { slowNetwork = false; applyLowData() }
    }

    // --- Bookmarks & history (persisted in SharedPreferences) ---
    private val prefs = app.getSharedPreferences("trendcreate", Context.MODE_PRIVATE)
    val bookmarks = mutableStateListOf<SiteItem>()
    val history = mutableStateListOf<SiteItem>()

    init {
        if (tabs.isEmpty()) newTab(HOME_URL)
        bookmarks.addAll(parseSites(prefs.getString("bookmarks", null)))
        history.addAll(parseSites(prefs.getString("history", null)))
        val controller = runtime.webExtensionController
        controller.installBuiltIn("resource://android/assets/lowdata/")
            .accept({ ext -> lowExt = ext; applyLowData() }, { })
        controller.installBuiltIn("resource://android/assets/ultradata/")
            .accept({ ext -> ultraExt = ext; applyLowData() }, { })
        try { connectivity?.registerDefaultNetworkCallback(netCallback) } catch (_: Exception) {}
    }

    fun cycleLowData() {
        lowDataMode = when (lowDataMode) {
            LowData.OFF -> LowData.AUTO
            LowData.AUTO -> LowData.ON
            LowData.ON -> LowData.OFF
        }
        applyLowData()
    }

    fun toggleUltra() { ultraMode = !ultraMode; applyLowData() }

    private fun applyLowData() {
        val controller = runtime.webExtensionController
        val useUltra = ultraMode
        val useLow = !ultraMode && lowDataActive
        lowExt?.let {
            if (useLow) controller.enable(it, WebExtensionController.EnableSource.APP)
            else controller.disable(it, WebExtensionController.EnableSource.APP)
        }
        ultraExt?.let {
            if (useUltra) controller.enable(it, WebExtensionController.EnableSource.APP)
            else controller.disable(it, WebExtensionController.EnableSource.APP)
        }
    }

    fun isBookmarked(url: String?): Boolean = url != null && bookmarks.any { it.url == url }

    /** Toggles bookmark for the active tab. Returns true if now bookmarked. */
    fun toggleBookmark(): Boolean {
        val tab = activeTab ?: return false
        val idx = bookmarks.indexOfFirst { it.url == tab.url }
        return if (idx >= 0) {
            bookmarks.removeAt(idx); saveBookmarks(); false
        } else {
            bookmarks.add(0, SiteItem(tab.url, tab.title, System.currentTimeMillis()))
            saveBookmarks(); true
        }
    }

    fun removeBookmark(item: SiteItem) { bookmarks.remove(item); saveBookmarks() }

    private fun recordHistory(url: String, title: String) {
        if (url.isBlank() || url == "about:blank") return
        if (history.firstOrNull()?.url == url) return
        history.add(0, SiteItem(url, title, System.currentTimeMillis()))
        while (history.size > 500) history.removeAt(history.size - 1)
        saveHistory()
    }

    fun removeHistory(item: SiteItem) { history.remove(item); saveHistory() }

    /**
     * Clears browsing data. History is removed by the [sinceMillis] window
     * (null = everything). Cookies/cache clearing is delegated to GeckoView's
     * StorageController, which clears the selected categories in full (the
     * engine does not expose a time-ranged cookie purge).
     */
    fun clearBrowsingData(sinceMillis: Long?, history: Boolean, cookies: Boolean, cache: Boolean) {
        if (history) {
            if (sinceMillis == null) {
                this.history.clear()
            } else {
                val cutoff = System.currentTimeMillis() - sinceMillis
                this.history.removeAll { it.time >= cutoff }
            }
            saveHistory()
        }
        var flags = 0L
        if (cookies) flags = flags or StorageController.ClearFlags.COOKIES or
                StorageController.ClearFlags.SITE_DATA
        if (cache) flags = flags or StorageController.ClearFlags.NETWORK_CACHE or
                StorageController.ClearFlags.IMAGE_CACHE
        if (flags != 0L) runtime.storageController.clearData(flags)
    }

    fun addToHomeScreen(ctx: Context) {
        val tab = activeTab ?: return
        if (!ShortcutManagerCompat.isRequestPinShortcutSupported(ctx)) return
        val intent = Intent(ctx, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse(tab.url)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        val label = tab.title.ifBlank { tab.url }.take(20)
        val info = ShortcutInfoCompat.Builder(ctx, "site-${tab.url.hashCode()}")
            .setShortLabel(label)
            .setLongLabel(label)
            .setIcon(IconCompat.createWithResource(ctx, R.drawable.ic_globe))
            .setIntent(intent)
            .build()
        ShortcutManagerCompat.requestPinShortcut(ctx, info, null)
    }

    private fun saveBookmarks() { prefs.edit().putString("bookmarks", bookmarks.toList().toJson()).apply() }
    private fun saveHistory() { prefs.edit().putString("history", history.toList().toJson()).apply() }

    override fun onCleared() {
        super.onCleared()
        try { connectivity?.unregisterNetworkCallback(netCallback) } catch (_: Exception) {}
    }

    fun newTab(initialUrl: String = HOME_URL, profile: String = "default") {
        val settings = GeckoSessionSettings.Builder()
            .usePrivateMode(false)
            .contextId(profile) // isolates cookies/storage per profile
            .build()
        val session = GeckoSession(settings)
        session.open(runtime)
        val home = initialUrl == HOME_URL
        val tab = Tab(nextId++, session, if (home) "" else initialUrl)
        tab.isHome = home
        wireDelegates(tab)
        if (!home) session.loadUri(initialUrl)
        tabs.add(tab)
        activeIndex = tabs.lastIndex
    }

    fun closeTab(index: Int) {
        val tab = tabs.getOrNull(index) ?: return
        // The last remaining tab is never removed; closing it returns to the
        // home screen instead of leaving the app with no tab.
        if (tabs.size == 1) {
            resetToHome(tab)
            return
        }
        tab.session.close()
        tabs.removeAt(index)
        activeIndex = activeIndex.coerceIn(0, tabs.lastIndex)
    }

    /** Replaces a tab's session with a fresh one and shows the home screen. */
    private fun resetToHome(tab: Tab) {
        tab.session.close()
        val settings = GeckoSessionSettings.Builder()
            .usePrivateMode(false)
            .contextId("default")
            .build()
        val session = GeckoSession(settings)
        session.open(runtime)
        tab.session = session
        tab.isHome = true
        tab.url = ""
        tab.title = "New Tab"
        tab.canGoBack = false
        tab.canGoForward = false
        wireDelegates(tab)
        activeIndex = tabs.indexOf(tab).coerceAtLeast(0)
    }

    fun selectTab(index: Int) { activeIndex = index.coerceIn(0, tabs.lastIndex) }

    /** Opens a URL, either in a new tab or by replacing the active tab. */
    fun openUrl(url: String, inNewTab: Boolean = true) {
        val tab = activeTab
        if (inNewTab || tab == null) newTab(url)
        else { tab.isHome = false; tab.session.loadUri(url) }
    }

    /** AI search shortcut (Google AI mode) from the home screen. */
    fun searchAi(query: String) {
        val tab = activeTab ?: return
        val q = query.trim()
        if (q.isEmpty()) return
        tab.isHome = false
        tab.session.loadUri("https://www.google.com/search?udm=50&q=" +
                java.net.URLEncoder.encode(q, "UTF-8"))
    }

    fun loadUrlOrSearch(input: String) {
        val tab = activeTab ?: return
        val trimmed = input.trim()
        val url = when {
            trimmed.isEmpty() -> return
            trimmed.matches(Regex("^[a-zA-Z][a-zA-Z0-9+.-]*://.*")) -> trimmed
            trimmed.contains(".") && !trimmed.contains(" ") -> "https://$trimmed"
            else -> "https://www.google.com/search?q=" + java.net.URLEncoder.encode(trimmed, "UTF-8")
        }
        tab.isHome = false
        tab.session.loadUri(url)
    }

    fun back() = activeTab?.session?.goBack()
    fun forward() = activeTab?.session?.goForward()
    fun reload() = activeTab?.session?.reload()

    // --- Find in page ---
    fun openFind() { findVisible = true }
    fun closeFind() {
        findVisible = false
        activeTab?.session?.finder?.clear()
        findQuery = ""; findCurrent = 0; findTotal = 0
    }
    fun find(query: String, forward: Boolean = true) {
        findQuery = query
        val finder = activeTab?.session?.finder ?: return
        if (query.isEmpty()) { finder.clear(); findCurrent = 0; findTotal = 0; return }
        val flags = if (forward) 0 else GeckoSession.FINDER_FIND_BACKWARDS
        finder.find(query, flags).accept { result ->
            if (result != null) {
                findCurrent = result.current
                findTotal = result.total
            }
        }
    }

    private fun wireDelegates(tab: Tab) {
        tab.session.navigationDelegate = object : GeckoSession.NavigationDelegate {
            override fun onLocationChange(
                session: GeckoSession, url: String?,
                perms: MutableList<GeckoSession.PermissionDelegate.ContentPermission>,
                hasUserGesture: Boolean
            ) {
                if (url != null) {
                    tab.url = url
                    if (url.startsWith("http")) tab.isHome = false
                }
            }

            override fun onCanGoBack(session: GeckoSession, canGoBack: Boolean) { tab.canGoBack = canGoBack }
            override fun onCanGoForward(session: GeckoSession, canGoForward: Boolean) { tab.canGoForward = canGoForward }
        }

        tab.session.progressDelegate = object : GeckoSession.ProgressDelegate {
            override fun onPageStart(session: GeckoSession, url: String) { tab.loading = true; tab.progress = 0 }
            override fun onPageStop(session: GeckoSession, success: Boolean) {
                tab.loading = false; tab.progress = 100
                if (success) recordHistory(tab.url, tab.title)
            }
            override fun onProgressChange(session: GeckoSession, progress: Int) { tab.progress = progress }
        }

        tab.session.contentDelegate = object : GeckoSession.ContentDelegate {
            override fun onTitleChange(session: GeckoSession, title: String?) {
                tab.title = if (title.isNullOrBlank()) "New Tab" else title
            }
        }
    }
}
