package com.trendcreate.browser

import android.app.Application
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import org.mozilla.geckoview.GeckoRuntime
import org.mozilla.geckoview.GeckoSession
import org.mozilla.geckoview.GeckoSessionSettings
import org.mozilla.geckoview.WebExtension
import org.mozilla.geckoview.WebExtensionController

/** Low data mode states. AUTO follows the measured connection speed. */
enum class LowData { OFF, AUTO, ON }

/** Below this estimated downstream bandwidth the link is treated as slow. */
private const val SLOW_THRESHOLD_KBPS = 1500

/** Default page shown for a fresh tab. */
const val HOME_URL = "https://www.google.com/"

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
    val session: GeckoSession,
    initialUrl: String
) {
    var url by mutableStateOf(initialUrl)
    var title by mutableStateOf("New Tab")
    var progress by mutableIntStateOf(0)
    var canGoBack by mutableStateOf(false)
    var canGoForward by mutableStateOf(false)
    var loading by mutableStateOf(false)
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
    val lowDataActive: Boolean
        get() = when (lowDataMode) {
            LowData.ON -> true
            LowData.OFF -> false
            LowData.AUTO -> slowNetwork
        }

    private var lowDataExt: WebExtension? = null
    private val connectivity = app.getSystemService(ConnectivityManager::class.java)
    private val netCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) {
            val kbps = caps.linkDownstreamBandwidthKbps
            slowNetwork = kbps in 1 until SLOW_THRESHOLD_KBPS
            applyLowData()
        }
        override fun onLost(network: Network) { slowNetwork = false; applyLowData() }
    }

    init {
        if (tabs.isEmpty()) newTab(HOME_URL)
        runtime.webExtensionController
            .installBuiltIn("resource://android/assets/lowdata/")
            .accept({ ext -> lowDataExt = ext; applyLowData() }, { })
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

    private fun applyLowData() {
        val ext = lowDataExt ?: return
        val controller = runtime.webExtensionController
        if (lowDataActive) {
            controller.enable(ext, WebExtensionController.EnableSource.APP)
        } else {
            controller.disable(ext, WebExtensionController.EnableSource.APP)
        }
    }

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
        val tab = Tab(nextId++, session, initialUrl)
        wireDelegates(tab)
        session.loadUri(initialUrl)
        tabs.add(tab)
        activeIndex = tabs.lastIndex
    }

    fun closeTab(index: Int) {
        val tab = tabs.getOrNull(index) ?: return
        tab.session.close()
        tabs.removeAt(index)
        if (tabs.isEmpty()) {
            newTab(HOME_URL)
        } else {
            activeIndex = activeIndex.coerceIn(0, tabs.lastIndex)
        }
    }

    fun selectTab(index: Int) { activeIndex = index.coerceIn(0, tabs.lastIndex) }

    fun loadUrlOrSearch(input: String) {
        val tab = activeTab ?: return
        val trimmed = input.trim()
        val url = when {
            trimmed.isEmpty() -> return
            trimmed.matches(Regex("^[a-zA-Z][a-zA-Z0-9+.-]*://.*")) -> trimmed
            trimmed.contains(".") && !trimmed.contains(" ") -> "https://$trimmed"
            else -> "https://www.google.com/search?q=" + java.net.URLEncoder.encode(trimmed, "UTF-8")
        }
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
            ) { if (url != null) tab.url = url }

            override fun onCanGoBack(session: GeckoSession, canGoBack: Boolean) { tab.canGoBack = canGoBack }
            override fun onCanGoForward(session: GeckoSession, canGoForward: Boolean) { tab.canGoForward = canGoForward }
        }

        tab.session.progressDelegate = object : GeckoSession.ProgressDelegate {
            override fun onPageStart(session: GeckoSession, url: String) { tab.loading = true; tab.progress = 0 }
            override fun onPageStop(session: GeckoSession, success: Boolean) { tab.loading = false; tab.progress = 100 }
            override fun onProgressChange(session: GeckoSession, progress: Int) { tab.progress = progress }
        }

        tab.session.contentDelegate = object : GeckoSession.ContentDelegate {
            override fun onTitleChange(session: GeckoSession, title: String?) {
                tab.title = if (title.isNullOrBlank()) "New Tab" else title
            }
        }
    }
}
