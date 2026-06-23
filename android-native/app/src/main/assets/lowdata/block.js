// Low Data Mode resource blocker.
// Cancels the heavy, bandwidth-dominant subresources (images, video/audio,
// fonts, plugins, beacons) while keeping the document's HTML, CSS and
// JavaScript intact so the page stays fully interactive on slow links.
//
// Note: scripts are intentionally NOT blocked. Blocking them (even only
// third-party ones) breaks click handlers and core behaviour on many sites,
// while the real data savings come from images and media.

var HEAVY = ["image", "imageset", "media", "font", "object", "object_subrequest",
             "beacon", "ping", "csp_report"];

browser.webRequest.onBeforeRequest.addListener(
  function (details) {
    if (HEAVY.indexOf(details.type) !== -1) {
      return { cancel: true };
    }
    return {};
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);
