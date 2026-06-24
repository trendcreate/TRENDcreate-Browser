// Ultra Low Data Mode resource blocker.
//
// On top of the heavy media that normal low-data mode already blocks, this
// also strips THIRD-PARTY scripts and embedded frames (ads, trackers,
// analytics, social widgets) which are the main cause of heavy CPU/JS work.
//
// Crucially it keeps FIRST-PARTY scripts, XHR/fetch and websockets, so the
// dynamic features that news sites and SNS rely on (timelines, infinite
// scroll, live updates) keep working. "First-party" is judged by registrable
// domain so a site's own CDNs / subdomains are not blocked.

var HEAVY = ["image", "imageset", "media", "font", "object", "object_subrequest",
             "beacon", "ping", "csp_report"];

// Common multi-label public suffixes so e.g. static.example.co.jp is treated
// as same-site as www.example.co.jp.
var MULTI = ["co.jp", "ne.jp", "or.jp", "go.jp", "ac.jp", "ad.jp", "ed.jp",
             "gr.jp", "lg.jp", "co.uk", "org.uk", "ac.uk", "gov.uk",
             "com.au", "com.br", "com.cn", "co.kr", "com.tw"];

function hostOf(url) {
    try { return new URL(url).host; } catch (e) { return ""; }
}

function registrableDomain(host) {
    var parts = host.split(".");
    if (parts.length <= 2) return host;
    var last2 = parts.slice(-2).join(".");
    if (MULTI.indexOf(last2) !== -1 && parts.length >= 3) {
        return parts.slice(-3).join(".");
    }
    return last2;
}

function isThirdParty(details) {
    var pageHost = hostOf(details.documentUrl || details.originUrl || "");
    var reqHost = hostOf(details.url);
    if (!pageHost || !reqHost) return false;
    return registrableDomain(pageHost) !== registrableDomain(reqHost);
}

browser.webRequest.onBeforeRequest.addListener(
    function (details) {
        if (HEAVY.indexOf(details.type) !== -1) {
            return { cancel: true };
        }
        if (details.type === "script" || details.type === "sub_frame") {
            if (isThirdParty(details)) {
                return { cancel: true };
            }
        }
        return {};
    },
    { urls: ["<all_urls>"] },
    ["blocking"]
);
