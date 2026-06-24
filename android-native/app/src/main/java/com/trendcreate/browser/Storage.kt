package com.trendcreate.browser

import org.json.JSONArray
import org.json.JSONObject

/** A saved site entry used for both bookmarks and history. */
data class SiteItem(val url: String, val title: String, val time: Long)

fun List<SiteItem>.toJson(): String {
    val arr = JSONArray()
    for (item in this) {
        arr.put(JSONObject().put("u", item.url).put("t", item.title).put("ts", item.time))
    }
    return arr.toString()
}

fun parseSites(raw: String?): List<SiteItem> {
    if (raw.isNullOrBlank()) return emptyList()
    return try {
        val arr = JSONArray(raw)
        (0 until arr.length()).map {
            val o = arr.getJSONObject(it)
            SiteItem(o.getString("u"), o.optString("t"), o.optLong("ts"))
        }
    } catch (e: Exception) {
        emptyList()
    }
}
