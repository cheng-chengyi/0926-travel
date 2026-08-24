/* 奧捷 12 天隨身手冊 — 離線快取
   改版時把 VERSION 加一，舊快取會自動清掉。 */
var VERSION = "oc-public-v35";

var CORE = [
  "./",
  "index.html",
  "app.css?v=34-public",
  "app.js?v=34-public",
  "data/itinerary.json",
  "data/borders.json",
  "manifest.webmanifest",
  "icons/icon-192-public-v32.png",
  "icons/icon-512-public-v32.png",
  "icons/icon-180-public-v32.png",
  "icons/icon-512-maskable-public-v32.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(VERSION).then(function (c) {
      // 先存核心檔，再讀 photos.json 把照片一併存起來
      return c.addAll(CORE).then(function () {
        return fetch("data/photos.json")
          .then(function (r) { return r.ok ? r.json() : []; })
          .then(function (list) {
            var urls = (list || []).map(function (f) { return "assets/photos/" + f; });
            // 單張失敗不讓整個安裝失敗
            return Promise.all(urls.map(function (u) {
              return c.add(u).catch(function () {});
            }));
          })
          .catch(function () {});
      });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === VERSION ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;

  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) {
        // 有網路時在背景更新一份，下次開啟就是新的
        fetch(req).then(function (res) {
          if (res && res.ok) caches.open(VERSION).then(function (c) { c.put(req, res); });
        }).catch(function () {});
        return hit;
      }
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return req.mode === "navigate" ? caches.match("index.html") : Response.error();
      });
    })
  );
});
