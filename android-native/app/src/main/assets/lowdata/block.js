// Low Data Mode resource blocker.
// Cancels heavy / non-essential subresources while keeping the document's
// HTML, CSS and first-party JavaScript so pages stay usable on slow links.

function hostOf(url) {
  try { return new URL(url).host; } catch (e) { return ""; }
}

// Always-blocked resource types (pure weight, rarely needed to read a page).
var HEAVY = ["image", "imageset", "media", "font", "object", "object_subrequest",
             "beacon", "ping", "csp_report", "speculative"];

browser.webRequest.onBeforeRequest.addListener(
  function (details) {
    var type = details.type;

    if (HEAVY.indexOf(type) !== -1) {
      return { cancel: true };
    }

    // Trim non-essential JavaScript: block cross-origin (third-party) scripts,
    // keep first-party scripts so the site's core behaviour still works.
    if (type === "script") {
      var pageHost = hostOf(details.documentUrl || details.originUrl || "");
      var reqHost = hostOf(details.url);
      if (pageHost && reqHost && pageHost !== reqHost) {
        return { cancel: true };
      }
    }

    return {};
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);
