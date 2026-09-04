(function () {
  "use strict";

  var D = null;          // 行程資料
  var tab = "days";
  var day = 1;
  var sub = "wx";        // 「實用」頁的子區段
  var view = document.getElementById("view");
  var railTrack = document.getElementById("railTrack");
  var rail = document.getElementById("rail");

  /* ── 小工具 ───────────────────────────── */
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function store(k, v) {
    try {
      if (v === undefined) return localStorage.getItem("oc-public:" + k);
      localStorage.setItem("oc-public:" + k, v);
    } catch (e) { return null; }
  }
  function two(n) { return (n < 10 ? "0" : "") + n; }
  function stamp(ms) {
    var d = new Date(ms);
    return two(d.getMonth() + 1) + "/" + two(d.getDate()) + " " +
           two(d.getHours()) + ":" + two(d.getMinutes());
  }

  /* ── 字級 ─────────────────────────────── */
  var sizes = ["", "l", "xl"];
  function applyType(v) {
    if (v) document.documentElement.setAttribute("data-type", v);
    else document.documentElement.removeAttribute("data-type");
  }
  applyType(store("type") || "");
  document.getElementById("btnType").addEventListener("click", function () {
    var cur = store("type") || "";
    var next = sizes[(sizes.indexOf(cur) + 1) % sizes.length];
    store("type", next);
    applyType(next);
  });

  /* ── 連線指示 ─────────────────────────── */
  var dot = document.getElementById("netDot");
  function net() {
    var off = !navigator.onLine;
    dot.classList.toggle("off", off);
    dot.title = off ? "離線中——手冊內容仍完整可用" : "已連線";
  }
  addEventListener("online", net); addEventListener("offline", net); net();

  /* ── 日期 ─────────────────────────────── */
  function todayIndex() {
    var now = new Date();
    var s = new Date(D.meta.start + "T00:00:00");
    var e = new Date(D.meta.end + "T23:59:59");
    if (now < s || now > e) return 0;
    return Math.floor((now - s) / 86400000) + 1;
  }
  function daysToGo() {
    var s = new Date(D.meta.start + "T00:00:00");
    return Math.ceil((s - new Date()) / 86400000);
  }
  function isoOfDay(n) {
    var s = new Date(D.meta.start + "T00:00:00");
    s.setDate(s.getDate() + (n - 1));
    return s.getFullYear() + "-" + two(s.getMonth() + 1) + "-" + two(s.getDate());
  }

  /* ══════════════════════════════════════════
     天氣：Open-Meteo，有網路就抓，抓到就存起來
     ══════════════════════════════════════════ */
  var WX = { data: null, at: 0, err: "" };

  var WMO = {
    0: "晴", 1: "大致晴", 2: "多雲時晴", 3: "陰",
    45: "有霧", 48: "霧凇", 51: "毛毛雨", 53: "毛毛雨", 55: "毛毛雨",
    56: "凍毛雨", 57: "凍毛雨", 61: "小雨", 63: "中雨", 65: "大雨",
    66: "凍雨", 67: "凍雨", 71: "小雪", 73: "中雪", 75: "大雪",
    77: "霰", 80: "陣雨", 81: "陣雨", 82: "強陣雨",
    85: "陣雪", 86: "強陣雪", 95: "雷雨", 96: "雷雨帶冰雹", 99: "雷雨帶冰雹"
  };
  function wmo(c) { return WMO[c] || "—"; }

  function wxLoad() {
    try {
      var raw = store("wx");
      if (raw) { var o = JSON.parse(raw); WX.data = o.d; WX.at = o.at; }
    } catch (e) {}
  }
  function wxSave() {
    try { store("wx", JSON.stringify({ d: WX.data, at: WX.at })); } catch (e) {}
  }

  function wxFetch(cb) {
    if (!navigator.onLine) {
      WX.err = "目前離線，顯示的是上次抓到的預報。";
      return cb && cb();
    }
    var lats = D.wxCities.map(function (c) { return c.lat; }).join(",");
    var lons = D.wxCities.map(function (c) { return c.lon; }).join(",");
    var url = "https://api.open-meteo.com/v1/forecast" +
      "?latitude=" + lats + "&longitude=" + lons +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
      "&timezone=Europe%2FPrague&forecast_days=16";
    WX.err = "";
    fetch(url).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (j) {
      var arr = Array.isArray(j) ? j : [j];
      var out = {};
      D.wxCities.forEach(function (c, i) {
        var s = arr[i] && arr[i].daily;
        if (s) out[c.key] = {
          time: s.time, code: s.weather_code,
          hi: s.temperature_2m_max, lo: s.temperature_2m_min,
          pop: s.precipitation_probability_max
        };
      });
      WX.data = out; WX.at = Date.now(); wxSave();
      cb && cb();
    }).catch(function (e) {
      WX.err = "抓不到預報（" + e.message + "），顯示的是上次的資料。";
      cb && cb();
    });
  }

  function wxFor(cityKey, iso) {
    if (!WX.data || !WX.data[cityKey]) return null;
    var s = WX.data[cityKey];
    var i = s.time.indexOf(iso);
    if (i < 0) return null;
    return { code: s.code[i], hi: s.hi[i], lo: s.lo[i], pop: s.pop[i] };
  }

  function wxChip(d) {
    if (!d.wx) return null;
    var c = (D.wxCities.filter(function (x) { return x.key === d.wx; })[0] || {});
    var f = wxFor(d.wx, isoOfDay(d.n));
    var box = el("div", "wxchip");
    if (f) {
      box.innerHTML = '<span class="wx-city">' + esc(c.name) + "</span>" +
        '<span class="wx-t">' + Math.round(f.lo) + "° / " + Math.round(f.hi) + "°</span>" +
        '<span class="wx-s">' + esc(wmo(f.code)) +
        (f.pop != null ? "・降雨 " + f.pop + "%" : "") + "</span>";
    } else {
      box.classList.add("empty");
      box.innerHTML = '<span class="wx-city">' + esc(c.name) + "</span>" +
        '<span class="wx-s">預報尚未涵蓋這天</span>';
    }
    return box;
  }

  /* ══════════════════════════════════════════
     匯率：歐洲央行每日參考匯率（Frankfurter）
     ══════════════════════════════════════════ */
  var FXERR = "";

  function fxFetch(cb) {
    if (!navigator.onLine) return cb && cb("目前離線，改用上次抓到的匯率。");
    fetch("https://api.frankfurter.app/latest?from=EUR&to=TWD,CZK")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (j) {
        var twdPerEur = j && j.rates && j.rates.TWD;
        var czkPerEur = j && j.rates && j.rates.CZK;
        if (!twdPerEur || !czkPerEur) throw new Error("回應缺欄位");
        store("fx:eur", twdPerEur.toFixed(2));
        store("fx:czk", (twdPerEur / czkPerEur).toFixed(3));
        store("fx:at", String(Date.now()));
        cb && cb("");
      })
      .catch(function (e) {
        cb && cb("抓不到匯率（" + e.message + "），下面兩格可以自己填。");
      });
  }

  /* ── 樂章條 ───────────────────────────── */
  function buildRail() {
    var t = todayIndex();
    railTrack.innerHTML = "";
    D.days.forEach(function (d) {
      var b = el("button", "pip" + (d.n === t ? " today" : ""));
      b.setAttribute("role", "tab");
      b.innerHTML = '<span class="pip-n">' + d.n + '</span><span class="pip-d">' + esc(d.date) + "</span>";
      b.addEventListener("click", function () { day = d.n; tab = "days"; syncTabs(); render(); });
      railTrack.appendChild(b);
    });
    if (t) day = t;
  }
  function markRail() {
    var pips = railTrack.children;
    for (var i = 0; i < pips.length; i++) {
      var on = tab === "days" && D.days[i].n === day;
      pips[i].setAttribute("aria-selected", on ? "true" : "false");
      if (on && pips[i].scrollIntoView) {
        try { pips[i].scrollIntoView({ block: "nearest", inline: "center" }); } catch (e) {}
      }
    }
    rail.style.display = tab === "days" ? "" : "none";
  }

  /* ── 區塊組件 ─────────────────────────── */
  function label(txt) { return el("div", "sec-label", esc(txt)); }
  function head(eyebrow, latin, h1, meta) {
    return el("div", "dayhead sectionhead",
      '<div class="eyebrow"><b>' + esc(eyebrow) + "</b>　" + esc(latin) + "</div>" +
      "<h1>" + esc(h1) + "</h1>" +
      '<div class="daymeta">' + esc(meta) + "</div>");
  }
  function bullets(arr) {
    var ul = el("ul", "musts");
    arr.forEach(function (m) { ul.appendChild(el("li", null, esc(m))); });
    return ul;
  }
  function attractionLink(name) {
    var a = el("a", "attraction-link", "查看景點地圖 ↗");
    a.href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(name);
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.setAttribute("aria-label", "在地圖中查看「" + name + "」");
    return a;
  }
  function shot(src, cap) {
    var f = el("figure", "shot");
    var img = new Image();
    img.alt = cap || "";
    img.loading = "lazy";
    img.onerror = function () {
      f.replaceChild(el("div", "ph", "尚未放入照片<br>assets/photos/" + esc(src)), img);
    };
    img.src = "assets/photos/" + src;
    f.appendChild(img);
    if (cap) f.appendChild(el("figcaption", null, esc(cap)));
    return f;
  }

  function hotelOption(o) {
    var c = el("article", "hotel-option");
    c.appendChild(el("h3", null, esc(o.name)));
    if (o.note) c.appendChild(el("p", "hotel-note", esc(o.note)));

    var query = o.mapQuery || o.name;
    var actions = el("div", "hotel-actions");
    [["官方網站", o.url],
     ["開啟地圖", "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(query)]].forEach(function (a) {
      if (!a[1]) return;
      var link = el("a", "hotel-link", esc(a[0]) + " ↗");
      link.href = a[1]; link.target = "_blank"; link.rel = "noopener noreferrer";
      actions.appendChild(link);
    });
    c.appendChild(actions);

    c.appendChild(el("p", "nearby-intro", esc(o.nearbyNote ||
      "住宿確認後，可用下列連結查看旅館周邊目前營業的商店。")));
    var nearby = el("div", "nearby-links");
    [["超市・食品", "supermarket near " + query, "補水、零食、水果與簡單早餐"],
     ["藥局・日用品", "pharmacy near " + query, "常備藥、盥洗用品與旅行補給"],
     ["購物・伴手禮", "shopping near " + query, "商場、在地商店與紀念品"]].forEach(function (s) {
      var a = el("a", "nearby-link", "<b>" + esc(s[0]) + "</b><span>" + esc(s[2]) + "</span>");
      a.href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(s[1]);
      a.target = "_blank"; a.rel = "noopener noreferrer";
      nearby.appendChild(a);
    });
    c.appendChild(nearby);
    return c;
  }

  /* 旅行社最終確認住宿（行程調整後更新版 2026/09/04）*/
  function pdfStay(d) {
    var confirmed = {
      "9/27": { name: "Grandior Hotel Prague", mapQ: "Grandior Hotel Prague Na Prikope 28", url: "https://www.grandiorhotel.com" },
      "9/28": { name: "Grandior Hotel Prague", mapQ: "Grandior Hotel Prague Na Prikope 28", url: "https://www.grandiorhotel.com" },
      "9/29": { name: "Grandior Hotel Prague", mapQ: "Grandior Hotel Prague Na Prikope 28", url: "https://www.grandiorhotel.com" },
      "9/30": { name: "Hotel Imperial Karlovy Vary 5★", mapQ: "Hotel Imperial Karlovy Vary", url: "https://www.spa-hotel-imperial.cz" },
      "10/1": { name: "Hotel Grand Český Krumlov", mapQ: "Hotel Grand Cesky Krumlov", url: "https://www.hotelgrandck.cz" },
      "10/2": { name: "Mercure Salzburg Central 4★", mapQ: "Mercure Salzburg Central", url: "https://all.accor.com/hotel/6635/index.en.shtml" },
      "10/3": { name: "Strandhotel Margaretha 4★", mapQ: "Strandhotel Margaretha St Wolfgang", url: "https://www.margaretha.at" },
      "10/4": { name: "SO/ Vienna 5★", mapQ: "SO Vienna Hotel Praterstrasse 1", url: "https://www.so-hotels.com/so-vienna",
                note: "多瑙運河旁設計型五星，現代感十足，可欣賞維也納城市景觀。" },
      "10/5": { name: "Sheraton Bratislava Hotel 5★", mapQ: "Sheraton Bratislava Hotel Pribinova 12", url: "https://www.marriott.com/en-us/hotels/btssi-sheraton-bratislava-hotel/overview/",
                note: "多瑙河畔五星，旅程最後一晚。飯店內享用升等西式三道式晚餐。🇸🇰 布拉提斯拉瓦" }
    }[d.date];
    if (!confirmed) return d.stay;
    return {
      label: confirmed.name,
      options: [{ name: confirmed.name, url: confirmed.url, mapQuery: confirmed.mapQ, note: confirmed.note || "" }],
      caveat: confirmed.note || "",
      tip: ""
    };
  }

  /* ══════════════════════════════════════════
     布拉格市區圖（自由日用）
     投影：lon 14.390–14.436 → x 40–660；lat 50.100–50.072 → y 45–565
     ══════════════════════════════════════════ */
  var PG = {
    castle:     [196, 212, "布拉格城堡", "end", -10, -6],
    stnicholas: [219, 268, "小城區聖尼古拉", "end", -10, 4],
    lennon:     [265, 301, "藍儂牆", "end", -10, 4],
    kampa:      [289, 314, "康帕島", "start", 10, 16],
    charles:    [328, 296, "查理大橋", "start", 10, -6],
    oldtown:    [455, 286, "舊城廣場・天文鐘", "start", 11, 4],
    parizska:   [432, 245, "巴黎大街", "end", -10, -6],
    powder:     [552, 283, "火藥塔・市民會館", "end", -10, 20],
    palladium:  [572, 240, "Palladium", "start", 10, 4],
    mucha:      [539, 338, "慕夏博物館", "start", 10, 4],
    wenceslas:  [542, 398, "瓦茨拉夫廣場", "start", 10, 4],
    national:   [358, 398, "國家劇院", "end", -10, 4],
    dancing:    [359, 500, "跳舞的房子", "start", 10, 4],
    naplavka:   [350, 555, "Náplavka 河岸", "start", 10, 4],
    vysehrad:   [420, 588, "高堡", "start", 10, -6],
    basilica:   [397, 570, "聖殿・高堡公墓", "end", -10, -6],
    museum:     [570, 438, "國家博物館", "start", 10, 4],
    ujezd:      [235, 392, "Újezd 纜車站", "end", -10, 4],
    petrin:     [106, 353, "佩特任瞭望塔", "start", 8, -8],
    ntm:        [511, 97,  "交通科技博物館", "end", -11, 4],
    troja:      [337, 26,  "植物園（圖外北方）", "start", 10, 20],
    tram22:     [300, 250, "", "start", 0, 0]
  };
  /* 伏爾塔瓦河概略河道，由六個實際河道點投影而成 */
  var VLTAVA = "M377 565 L347 435 L323 305 L364 212 L485 147 L687 91";

  function pragueSvg(stops) {
    var seen = {}, seq = [];
    (stops || []).forEach(function (s) {
      // 只有具名站點才進地圖，無名輔助點（如電車路線）不畫，免得拉出斷線
      if (PG[s.k] && PG[s.k][2] && !seen[s.k]) { seen[s.k] = 1; seq.push(s.k); }
    });

    var line = seq.length > 1 ? '<path class="pgleg" d="' +
      seq.map(function (k, i) {
        return (i ? "L" : "M") + PG[k][0] + " " + PG[k][1];
      }).join(" ") + '"/>' : "";

    var dots = Object.keys(PG).map(function (k) {
      var p = PG[k];
      if (!p[2]) return "";                      // 沒名字的輔助點不畫
      var on = seen[k];
      var g = '<g class="pgnode' + (on ? " on" : "") + '">';
      g += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (on ? 8 : 4.5) + '"/>';
      if (on) {
        g += lbl("pglab", p[0] + p[4], p[1] + p[5], p[3], p[2]);
      }
      return g + "</g>";
    }).join("");

    return '<svg viewBox="0 0 700 610" class="routemap pgmap" ' +
      'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="布拉格市區路線圖">' +
      '<path class="river" d="' + VLTAVA + '"/>' +
      '<text class="mcountry" x="252" y="214" text-anchor="middle">小城區</text>' +
      '<text class="mcountry" x="505" y="182" text-anchor="middle">舊城區</text>' +
      '<text class="mcountry" x="578" y="482" text-anchor="middle">新城區</text>' +
      '<text class="mriver" x="330" y="545" text-anchor="middle">伏爾塔瓦河</text>' +
      line + dots + "</svg>";
  }

  function freeDay(d) {
    var w = el("div");
    w.appendChild(label("自由活動建議路線"));
    if (d.freeDayNote) w.appendChild(el("p", "hint", esc(d.freeDayNote)));

    var savedRoute = store("route:" + d.n);
    var picked = savedRoute === null ? (d.routes[0] && d.routes[0].name) : savedRoute;

    d.routes.forEach(function (r) {
      var on = picked === r.name;
      var c = el("div", "card pick" + (on ? " on" : ""));

      var h = el("div", "rhead");
      h.appendChild(el("h3", null, esc(r.name) +
        '<span class="rtag">' + esc(r.tag) + "</span>"));
      h.appendChild(el("div", "rmeta", esc(r.hours) + "　" + esc(r.sum)));
      c.appendChild(h);
      c.appendChild(el("p", null, esc(r.detail)));

      var b = el("button", "pickbtn", on ? "已選為今日主線　收合" : "選這條　看完整規劃");
      b.addEventListener("click", function () {
        store("route:" + d.n, on ? "" : r.name);
        render(true);              // 保留捲動位置，不跳回頁首
      });
      c.appendChild(b);

      if (on) {
        var box = el("div", "mapwrap compact");
        box.innerHTML = pragueSvg(r.stops);
        c.appendChild(box);

        c.appendChild(el("div", "kk", "時間軸"));
        var tl = el("ol", "tline");
        r.stops.forEach(function (s) {
          var li = el("li");
          li.appendChild(el("span", "tt", esc(s.t)));
          var spot = document.createElement("a");
          spot.className = "maplink";
          spot.href = s.map || ("https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(s.n + " Prague"));
          spot.target = "_blank";
          spot.rel = "noopener noreferrer";
          spot.textContent = s.n + "　開啟地圖 ↗";
          li.appendChild(spot);
          if (s.note) li.appendChild(el("span", "tn", esc(s.note)));
          tl.appendChild(li);
        });
        c.appendChild(tl);

        c.appendChild(el("div", "kk", "費用概估（每人・克朗）"));
        var t = el("table", "kv");
        r.cost.forEach(function (row) {
          var tr = el("tr");
          tr.appendChild(el("td", "k", esc(row[0])));
          tr.appendChild(el("td", null, esc(row[1])));
          t.appendChild(tr);
        });
        var tr2 = el("tr", "tot");
        tr2.appendChild(el("td", "k", "合計"));
        tr2.appendChild(el("td", null, esc(r.sum)));
        t.appendChild(tr2);
        c.appendChild(t);

        c.appendChild(el("div", "kk", "評估"));
        var ev = el("div", "box");
        ev.appendChild(el("div", null, "<b>適合</b>　" + esc(r.eval.fit)));
        ev.appendChild(el("div", null, "<b>腳程</b>　" + esc(r.eval.legs)));
        ev.appendChild(el("div", null, "<b>留意</b>　" + esc(r.eval.risk)));
        c.appendChild(ev);
      }

      w.appendChild(c);
    });
    return w;
  }

  /* ── 畫面：日次 ───────────────────────── */
  function renderDay() {
    var d = D.days.filter(function (x) { return x.n === day; })[0];
    if (!d) return;
    var w = el("div");

    var h = el("div", "dayhead");
    h.appendChild(el("div", "daybadge", '<span>DAY</span><b>' + d.n + '</b>'));
    var hc = el("div", "daycopy");
    hc.appendChild(el("div", "eyebrow", "<b>" + esc(d.movement) + "</b>　" + esc(d.tempo)));
    hc.appendChild(el("h1", null, esc(d.title)));
    hc.appendChild(el("div", "daymeta",
      esc(d.date) + "（" + esc(d.weekday) + "）　" + esc(d.city) +
      (d.km ? '<span class="km">車程 ' + esc(d.km) + "</span>" : "")));
    h.appendChild(hc);
    w.appendChild(h);
    w.appendChild(el("div", "timeline-rule", '<span>TODAY\'S JOURNEY</span>'));

    var chip = wxChip(d);
    if (chip) w.appendChild(chip);

    if (DAYNODES[d.n]) {
      w.appendChild(mapBox(DAYNODES[d.n], true));
    }

    if (d.route) w.appendChild(el("div", "routeline", esc(d.route)));

    if ((d.n === 1 || d.n === 11) && D.meta.flights && D.meta.flights.length) {
      var flight = D.meta.flights[d.n === 1 ? 0 : 1];
      var fc = el("section", "flight-card");
      fc.appendChild(el("div", "flight-no", '<span>航班</span><b>' + esc(flight.no) + '</b>'));
      var times = el("div", "flight-times");
      times.appendChild(el("div", "flight-leg", '<small>起飛</small><strong>' + esc(flight.dep) + '</strong>'));
      times.appendChild(el("div", "flight-arrow", '✈'));
      times.appendChild(el("div", "flight-leg", '<small>抵達</small><strong>' + esc(flight.arr) + '</strong>'));
      fc.appendChild(times);
      fc.appendChild(el("div", "flight-meta", esc(flight.date) + '　' + esc(flight.dur) + '　' + esc(flight.ac)));
      w.appendChild(fc);
    }

    if (d.n === 1 && D.meta.meet) {
      var m = D.meta.meet;
      var mb = el("div", "box stay");
      mb.appendChild(el("div", null, "<b>集合</b>　" + esc(m.time)));
      mb.appendChild(el("div", "opt", "<strong>" + esc(m.place) + "・" + esc(m.terminal) +
        "</strong><br><span>" + esc(m.warn) + "</span>"));
      (D.meta.hsr || []).slice(0, 1).forEach(function (t) {
        mb.appendChild(el("div", "opt", "<strong>高鐵 " + esc(t.when) + "　" + esc(t.leg) +
          "</strong><br><span>" + esc(t.note) + "</span>"));
      });
      w.appendChild(mb);
    }

    if (d.n === 12 && D.meta.hsr && D.meta.hsr[1]) {
      var rt = D.meta.hsr[1];
      var rb = el("div", "box stay");
      rb.appendChild(el("div", null, "<b>回程高鐵</b>"));
      rb.appendChild(el("div", "opt", "<strong>高鐵 " + esc(rt.when) + "　" + esc(rt.leg) +
        "</strong><br><span>" + esc(rt.note) + "</span>"));
      w.appendChild(rb);
    }

    if (d.summary) w.appendChild(el("p", "lede", esc(d.summary)));

    if (d.caveat) {
      w.appendChild(el("div", "box warn",
        '<b>留意</b><span class="caveat">' + esc(d.caveat) + "</span>"));
    }

    if (d.routes && d.routes.length) {
      w.appendChild(freeDay(d));
    }

    if (d.sights && d.sights.length) {
      w.appendChild(label("景點與必看重點"));
      d.sights.forEach(function (s) {
        var c = el("div", "card");
        c.appendChild(el("h3", null, esc(s.name)));
        c.appendChild(attractionLink(s.name));
        if (s.history) c.appendChild(el("p", "hist", esc(s.history)));
        if (s.musts && s.musts.length) c.appendChild(bullets(s.musts));
        w.appendChild(c);
      });
    }

    if ((d.tickets && d.tickets.length) || (d.offbus && d.offbus.length) ||
        (d.special && d.special.length)) {
      w.appendChild(label("今日行程包含"));
      var ib = el("div", "box");
      if (d.tickets && d.tickets.length) {
        ib.appendChild(el("div", "kk", "門票"));
        ib.appendChild(bullets(d.tickets));
      }
      if (d.offbus && d.offbus.length) {
        ib.appendChild(el("div", "kk", "下車參觀"));
        ib.appendChild(bullets(d.offbus));
      }
      if (d.special && d.special.length) {
        ib.appendChild(el("div", "kk", "特別安排"));
        ib.appendChild(bullets(d.special));
      }
      w.appendChild(ib);
    }

    if (d.photos && d.photos.length) {
      w.appendChild(label("照片"));
      d.photos.forEach(function (p) { w.appendChild(shot(p.file, p.cap)); });
    }

    if (d.frames && d.frames.length) {
      w.appendChild(label("經典畫面怎麼拍"));
      w.appendChild(bullets(d.frames));
    }

    if (d.food && (d.food.breakfast || d.food.lunch || d.food.dinner)) {
      w.appendChild(label("餐食"));
      var fb = el("div", "box");
      if (d.food.breakfast) fb.appendChild(el("div", null, "<b>早餐</b>　" + esc(d.food.breakfast)));
      if (d.food.lunch) fb.appendChild(el("div", null, "<b>午餐</b>　" + esc(d.food.lunch)));
      if (d.food.dinner) fb.appendChild(el("div", null, "<b>晚餐</b>　" + esc(d.food.dinner)));
      w.appendChild(fb);
    }

    if (d.stay) {
      var shownStay = pdfStay(d);
      w.appendChild(label("今晚住宿"));
      var sb = el("div", "box stay");
      sb.appendChild(el("div", null, "<b>" + esc(shownStay.label) + "</b>"));
      (shownStay.options || []).forEach(function (o) { sb.appendChild(hotelOption(o)); });
      if (shownStay.caveat) sb.appendChild(el("span", "caveat", esc(shownStay.caveat)));
      if (shownStay.tip) sb.appendChild(el("span", "caveat", "提醒：" + esc(shownStay.tip)));
      w.appendChild(sb);
    }

    if (d.shop) {
      w.appendChild(label("買什麼・吃什麼"));
      w.appendChild(el("div", "box", esc(d.shop)));
    }

    w.appendChild(dailyCheck(d));
    w.appendChild(dailyRecord(d));

    view.appendChild(w);
  }

  /* ── 每日確認清單（逐日各自記住勾選）───── */
  function dailyCheck(d) {
    var wrap = el("div");
    var dc = D.dailyCheck || { base: [], byDay: {} };
    var extra = (dc.byDay && dc.byDay[String(d.n)]) || [];
    var items = extra.map(function (t) { return { t: t, own: true }; })
      .concat(dc.base.map(function (t) { return { t: t, own: false }; }));
    if (!items.length) return wrap;

    var done = 0;
    items.forEach(function (_, i) { if (store("dc:" + d.n + ":" + i) === "1") done++; });

    wrap.appendChild(label("第 " + d.n + " 天確認"));
    var prog = el("div", "prog");
    function tally() {
      prog.textContent = "已勾 " + done + " / " + items.length +
        "　每天各自記錄，隔天重新開始";
    }
    tally();
    wrap.appendChild(prog);

    var ul = el("ul", "check");
    var boxes = [];
    items.forEach(function (it, i) {
      var key = "dc:" + d.n + ":" + i;
      var li = el("li");
      var lab = el("label");
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = store(key) === "1";
      if (cb.checked) li.className = "done";
      cb.addEventListener("change", function () {
        store(key, cb.checked ? "1" : "0");
        li.classList.toggle("done", cb.checked);
        done += cb.checked ? 1 : -1;
        tally();                       // 只改這一列與計數，不重繪整頁
      });
      lab.appendChild(cb);
      lab.appendChild(el("span", it.own ? "own" : null, esc(it.t)));
      li.appendChild(lab);
      ul.appendChild(li);
      boxes.push({ cb: cb, li: li, key: key });
    });
    wrap.appendChild(ul);

    var reset = el("button", "btn ghost", "清空第 " + d.n + " 天勾選");
    reset.addEventListener("click", function () {
      boxes.forEach(function (b) {
        store(b.key, "0");
        b.cb.checked = false;
        b.li.classList.remove("done");
      });
      done = 0;
      tally();
    });
    wrap.appendChild(reset);
    return wrap;
  }

  /* ── 每日個人紀錄（逐日 localStorage）────── */
  function dailyRecord(d) {
    var wrap = el("section", "daily-record");
    wrap.appendChild(label("第 " + d.n + " 天個人紀錄"));
    [["note", "今日筆記", "例如：集合時間、想回訪的店"],
     ["expense", "今日花費", "例如：午餐 320 CZK、咖啡 85 CZK"],
     ["reflection", "心得與提醒", "今天最喜歡什麼？明天要注意什麼？"]].forEach(function (f) {
      var field = el("div", "field");
      var id = "dayrec_" + d.n + "_" + f[0];
      var lb = el("label", null, esc(f[1]));
      lb.setAttribute("for", id);
      var input = document.createElement("textarea");
      input.id = id;
      input.placeholder = f[2];
      input.value = store("dayrec:" + d.n + ":" + f[0]) || "";
      input.addEventListener("input", function () {
        store("dayrec:" + d.n + ":" + f[0], input.value);
      });
      field.appendChild(lb);
      field.appendChild(input);
      wrap.appendChild(field);
    });
    wrap.appendChild(el("p", "hint", "自動保存在這台裝置，下次開啟仍會保留。"));
    return wrap;
  }

  /* ── 畫面：總覽（路線圖＋逐日表＋城市導覽）── */

  /* 節點座標與 tools/make-borders.py 使用同一組線性投影 */
  var MAP = [
    { k: "kv",  n: "卡羅維瓦利", x: 101, y: 86,  d: "9/30", lx: 8,   ly: -24, a: "start" },
    { k: "ml",  n: "瑪麗安斯基", x: 79,  y: 122, d: "9/30 宿", lx: 8, ly: 16, a: "start" },
    { k: "pr",  n: "布拉格",    x: 301, y: 105, d: "9/27–29 宿 3 晚", lx: 12, ly: 5, a: "start", big: 1 },
    { k: "ck",  n: "庫倫洛夫",  x: 287, y: 277, d: "10/1 宿", lx: 12, ly: 5, a: "start" },
    { k: "bg",  n: "貝希特斯加登", x: 95, y: 455, d: "10/2 鹽礦", lx: -6, ly: 26, a: "start" },
    { k: "sz",  n: "薩爾茲堡",  x: 133, y: 401, d: "10/2 宿", lx: -10, ly: -6, a: "end" },
    { k: "sw",  n: "聖沃夫岡",  x: 178, y: 418, d: "10/3", lx: 9,  ly: -10, a: "start" },
    { k: "ha",  n: "哈修塔特",  x: 218, y: 452, d: "10/3 宿", lx: 10, ly: 16, a: "start" },
    { k: "vi",  n: "維也納",    x: 553, y: 358, d: "10/4 宿", lx: -12, ly: -10, a: "end", big: 1 },
    { k: "pd",  n: "潘朵芙",    x: 615, y: 388, d: "10/5 逛", lx: -14, ly: 22,  a: "end" },
    { k: "bt",  n: "布拉提斯拉瓦", x: 660, y: 310, d: "10/5 宿 🇸🇰", lx: 10, ly: -8, a: "start" }
  ];
  var LEGS = ["pr", "kv", "ml", "ck", "bg", "sz", "sw", "ha", "vi", "pd", "bt"];

  /* 各日對應到路線圖上的節點；第 1、12 天沒有歐洲段 */
  var DAYNODES = {
    2: ["pr"], 3: ["pr"], 4: ["pr"],
    5: ["pr", "kv", "ml"], 6: ["ml", "ck"], 7: ["ck", "bg", "sz"],
    8: ["sz", "sw", "ha"], 9: ["ha", "vi"], 10: ["vi", "pd", "bt"], 11: ["bt"]
  };

  var COUNTRY = [
    { k: "cz", n: "捷克", x: 440, y: 186, a: "start" },
    { k: "at", n: "奧地利", x: 392, y: 396, a: "start" },
    { k: "de", n: "德國", x: 52,  y: 330, a: "start" },
    { k: "sk", n: "斯洛伐克", x: 690, y: 244, a: "end" }
  ];

  var BORDERS = null;   // data/borders.json

  function at(k) {
    for (var i = 0; i < MAP.length; i++) if (MAP[i].k === k) return MAP[i];
    return null;
  }
  function pathOf(keys) {
    return keys.map(function (k, i) {
      var p = at(k);
      return (i ? "L" : "M") + p.x + " " + p.y;
    }).join(" ");
  }

  /* active：要強調的節點代碼陣列，傳 null 代表畫全程 */
  function routeSvg(active, compact) {
    var on = {};
    (active || []).forEach(function (k) { on[k] = 1; });
    var hasActive = !!(active && active.length);

    var land = (BORDERS || []).map(function (b) {
      var cls = (b.k === "cz" || b.k === "at") ? "land land-on" : "land";
      return '<path class="' + cls + '" d="' + b.d + '"/>';
    }).join("");

    var names = BORDERS ? COUNTRY.map(function (c) {
      return '<text class="mcountry" x="' + c.x + '" y="' + c.y +
        '" text-anchor="' + c.a + '">' + esc(c.n) + "</text>";
    }).join("") : "";

    var base = '<path class="leg' + (hasActive ? " leg-dim" : "") +
      '" d="' + pathOf(LEGS) + '"/>';

    var hot = "";
    if (hasActive && active.length > 1) {
      hot = '<path class="leg leg-hot" d="' + pathOf(active) + '"/>';
    }

    var nodes = MAP.map(function (m) {
      var lit = !hasActive || on[m.k];
      var r = m.big ? 7 : 5;
      if (hasActive && on[m.k]) r += 2;
      var g = '<g class="node' + (lit ? "" : " node-dim") +
        '" data-day="' + (dayOfNode(m.k) || "") + '">';
      g += '<circle cx="' + m.x + '" cy="' + m.y + '" r="' + r +
           '" class="mp' + (m.big ? " mp-big" : "") + (on[m.k] ? " mp-hot" : "") + '"/>';
      if (!compact || lit) {
        // 每個標籤畫兩層：底層描邊當光暈，上層填色，避免壓在線條上看不清
        g += lbl("mlab", m.x + m.lx, m.y + m.ly, m.a, m.n);
        g += lbl("mdate", m.x + m.lx, m.y + m.ly + 15, m.a, m.d);
      }
      return g + "</g>";
    }).join("");

    var fly = compact ? "" :
      '<path class="fly" d="M301 105 L301 32"/>' +
      '<text class="mfly" x="301" y="22" text-anchor="middle">CI067　9/26 夜 台北出發</text>' +
      '<path class="fly" d="M553 358 L664 470"/>' +
      '<text class="mfly" x="664" y="490" text-anchor="end">CI064　10/6 維也納返台</text>';

    return '<svg viewBox="0 0 700 530" class="routemap" ' +
      'xmlns="http://www.w3.org/2000/svg" role="img" ' +
      'aria-label="奧地利捷克 12 天行程路線圖">' +
      land + names + fly + base + hot + nodes + "</svg>";
  }

  function lbl(cls, x, y, anchor, txt) {
    var t = '" x="' + x + '" y="' + y + '" text-anchor="' + anchor + '">' + esc(txt) + "</text>";
    return '<text class="' + cls + ' halo' + t + '<text class="' + cls + t;
  }

  function dayOfNode(k) {
    for (var n in DAYNODES) {
      if (DAYNODES[n].length === 1 && DAYNODES[n][0] === k) return n;
    }
    for (var m in DAYNODES) {
      if (DAYNODES[m][DAYNODES[m].length - 1] === k) return m;
    }
    return "";
  }

  function mapBox(active, compact) {
    var box = el("div", "mapwrap" + (compact ? " compact" : ""));
    box.innerHTML = routeSvg(active, compact);
    box.addEventListener("click", function (e) {
      var g = e.target.closest ? e.target.closest(".node") : null;
      var n = g && g.getAttribute("data-day");
      if (n) { day = parseInt(n, 10); tab = "days"; syncTabs(); render(); }
    });
    return box;
  }

  function renderCities() {
    view.appendChild(head("總覽", "Itinerario", "12 天走過哪裡",
      "115/9/26 － 10/7　捷克進、奧地利出"));
    view.appendChild(el("div", "stave"));

    view.appendChild(mapBox(null, false));
    view.appendChild(el("p", "hint",
      "國界為真實輪廓（Natural Earth 1:110m），城市位置依經緯度投影，" +
      "點任一城市可跳到那一天。深紅線是行車路線，綠色虛線是進出港航班。"));

    view.appendChild(label("逐日一覽"));
    var t = el("table", "kv ovt");
    D.days.forEach(function (d) {
      var tr = el("tr");
      if (d.n === todayIndex()) tr.className = "on";
      tr.appendChild(el("td", "k",
        esc(d.date) + '<br><span class="dim">' + esc(d.weekday) + "</span>"));
      var stay = d.stay && d.stay.label ? d.stay.label : "";
      tr.appendChild(el("td", null,
        "<b>" + esc(d.city) + "</b>" +
        (d.km ? '<span class="km">' + esc(d.km) + "</span>" : "") +
        (stay ? '<br><span class="dim">' + esc(stay) + "</span>" : "")));
      t.appendChild(tr);
    });
    view.appendChild(t);

    view.appendChild(label("八座城的來歷"));
    D.cities.forEach(function (c) {
      var card = el("div", "card");
      card.appendChild(el("h3", null, esc(c.name)));
      card.appendChild(el("p", "hist", esc(c.text)));
      view.appendChild(card);
    });
    view.appendChild(label("行程涵蓋的世界遺產"));
    view.appendChild(bullets(D.unesco));
    view.appendChild(label("超值好禮"));
    view.appendChild(bullets(D.gifts));
  }

  /* ── 畫面：購物 ───────────────────────── */
  function renderShop() {
    view.appendChild(head("採買", "Souvenir", "購物・小吃・伴手禮",
      "依城市排序，主力採買日為 9/29 布拉格與 10/4 潘朵芙"));
    view.appendChild(el("div", "stave"));
    D.shopping.forEach(function (s) {
      view.appendChild(label(s.city));
      var t = el("table", "kv");
      s.rows.forEach(function (r) {
        var tr = el("tr");
        tr.appendChild(el("td", "k", esc(r[0])));
        tr.appendChild(el("td", null, esc(r[1])));
        t.appendChild(tr);
      });
      view.appendChild(t);
    });
  }

  /* ══════════════════════════════════════════
     畫面：實用（天氣／匯率／須知／提醒／打包／團費）
     ══════════════════════════════════════════ */
  var SUBS = [["wx", "天氣"], ["fx", "匯率"], ["basic", "須知"],
              ["tips", "提醒"], ["pack", "打包"], ["fee", "團費"]];

  function renderInfo() {
    view.appendChild(head("實用", "Pratico", "出門前與路上",
      "天氣、匯率、退稅、打包、團費"));
    var nav = el("div", "seg");
    SUBS.forEach(function (s) {
      var b = el("button", "seg-b" + (sub === s[0] ? " on" : ""), esc(s[1]));
      b.addEventListener("click", function () { sub = s[0]; render(); });
      nav.appendChild(b);
    });
    view.appendChild(nav);
    view.appendChild(el("div", "stave"));

    if (sub === "wx") return subWx();
    if (sub === "fx") return subFx();
    if (sub === "basic") return subBasic();
    if (sub === "tips") return subTips();
    if (sub === "pack") return subPack();
    return subFee();
  }

  function subWx() {
    var bar = el("div", "wxbar");
    var btn = el("button", "btn", "更新預報");
    btn.addEventListener("click", function () {
      btn.disabled = true; btn.textContent = "更新中…";
      wxFetch(function () { render(); });
    });
    bar.appendChild(btn);
    bar.appendChild(el("span", "hint", WX.at ? "更新於 " + stamp(WX.at) : "尚未抓過預報"));
    view.appendChild(bar);

    if (WX.err) view.appendChild(el("div", "box warn", esc(WX.err)));
    if (!navigator.onLine) {
      view.appendChild(el("p", "hint",
        "離線中。有網路時（飯店 Wi-Fi 或網卡）按一次「更新預報」，之後沒網路也看得到。"));
    }

    var gap = daysToGo();
    if (gap > 16) {
      view.appendChild(el("div", "box",
        "<b>距離出發還有 " + gap + " 天</b>" +
        '<span class="caveat">氣象預報只看得到未來 16 天，出發前兩週左右才會抓到這趟的資料。' +
        "在那之前先看下面的氣候概況。</span>"));
    }

    if (WX.data) {
      view.appendChild(label("逐日預報"));
      var t = el("table", "kv wxtab");
      D.days.forEach(function (d) {
        if (!d.wx) return;
        var f = wxFor(d.wx, isoOfDay(d.n));
        var c = (D.wxCities.filter(function (x) { return x.key === d.wx; })[0] || {});
        var tr = el("tr");
        tr.appendChild(el("td", "k", d.date + "　" + esc(c.name)));
        tr.appendChild(el("td", null, f
          ? Math.round(f.lo) + "° / " + Math.round(f.hi) + "°　" + esc(wmo(f.code)) +
            (f.pop != null ? "　降雨 " + f.pop + "%" : "")
          : '<span class="dim">預報未涵蓋</span>'));
        t.appendChild(tr);
      });
      view.appendChild(t);
    }

    view.appendChild(label("氣候概況（永遠離線可看）"));
    view.appendChild(el("p", "hist", esc(D.climate)));
  }

  function subFx() {
    var rEur = parseFloat(store("fx:eur") || "36.5");
    var rCzk = parseFloat(store("fx:czk") || "1.52");
    var at = parseInt(store("fx:at") || "0", 10);

    var money = el("section", "visual-card money-card");
    money.appendChild(el("div", "visual-copy",
      '<span class="visual-kicker">CASH GUIDE</span><h3>鈔票與硬幣</h3>' +
      '<p>奧地利、德國使用歐元；捷克主要使用克朗。</p>'));
    money.appendChild(el("div", "cash-grid",
      '<div class="cash-country"><b>歐元 EUR</b>' +
        '<div class="cash-art" role="img" aria-label="歐元鈔票與硬幣示意">' +
          '<span class="banknote eur-note"><i>€</i><strong>20</strong></span>' +
          '<span class="coin euro-two">€2</span><span class="coin euro-one">€1</span>' +
        '</div><small>紙鈔 €5–€200<br>硬幣 1 cent–€2</small></div>' +
      '<div class="cash-country"><b>捷克克朗 CZK</b>' +
        '<div class="cash-art" role="img" aria-label="捷克克朗鈔票與硬幣示意">' +
          '<span class="banknote czk-note"><i>Kč</i><strong>200</strong></span>' +
          '<span class="coin czk-fifty">50</span><span class="coin czk-twenty">20</span>' +
        '</div><small>紙鈔 100–5000 Kč<br>硬幣 1–50 Kč</small></div>'));
    view.appendChild(money);

    var bar = el("div", "wxbar");
    var btn = el("button", "btn", "自動更新匯率");
    btn.addEventListener("click", function () {
      btn.disabled = true; btn.textContent = "更新中…";
      fxFetch(function (msg) {
        if (msg) { FXERR = msg; }
        render();
      });
    });
    bar.appendChild(btn);
    bar.appendChild(el("span", "hint", at ? "更新於 " + stamp(at) : "尚未抓過，以下為預設值"));
    view.appendChild(bar);

    if (FXERR) { view.appendChild(el("div", "box warn", esc(FXERR))); FXERR = ""; }

    view.appendChild(el("p", "hint",
      "抓的是歐洲央行每日參考匯率（中價）。銀行現鈔賣出通常比中價再貴 1–2%，" +
      "刷卡則接近中價再加約 1.5% 國外交易手續費。想用實際換到的價格，下面兩格可以直接改。"));

    [["eur", "1 歐元 = ? 台幣", rEur], ["czk", "1 克朗 = ? 台幣", rCzk]].forEach(function (f) {
      var wrap = el("div", "field");
      wrap.appendChild(el("label", null, esc(f[1])));
      var ip = document.createElement("input");
      ip.type = "number"; ip.step = "0.01"; ip.inputMode = "decimal"; ip.value = f[2];
      ip.addEventListener("input", function () {
        store("fx:" + f[0], ip.value);
        if (f[0] === "eur") rEur = parseFloat(ip.value) || 0;
        else rCzk = parseFloat(ip.value) || 0;
      });
      wrap.appendChild(ip);
      view.appendChild(wrap);
    });

    view.appendChild(label("換算"));
    var inputs = {};
    [["eur", "歐元 EUR"], ["czk", "克朗 CZK"], ["twd", "台幣 TWD"]].forEach(function (f) {
      var wrap = el("div", "field");
      wrap.appendChild(el("label", null, esc(f[1])));
      var ip = document.createElement("input");
      ip.type = "number"; ip.inputMode = "decimal";
      ip.addEventListener("input", function () { from(f[0], ip.value); });
      inputs[f[0]] = ip;
      wrap.appendChild(ip);
      view.appendChild(wrap);
    });

    function from(k, v) {
      var n = parseFloat(v);
      if (isNaN(n)) {
        ["eur", "czk", "twd"].forEach(function (x) { if (x !== k) inputs[x].value = ""; });
        return;
      }
      var twd = k === "twd" ? n : (k === "eur" ? n * rEur : n * rCzk);
      if (k !== "twd") inputs.twd.value = Math.round(twd);
      if (k !== "eur") inputs.eur.value = rEur ? (twd / rEur).toFixed(2) : "";
      if (k !== "czk") inputs.czk.value = rCzk ? (twd / rCzk).toFixed(0) : "";
    }

    view.appendChild(el("p", "hint",
      "口袋換算：€1 約 " + Math.round(rEur) + " 元、100 克朗約 " + Math.round(rCzk * 100) +
      " 元。退稅門檻——捷克 2001 克朗（約 " + Math.round(rCzk * 2001) +
      " 元）、奧地利 €75（約 " + Math.round(rEur * 75) + " 元）。"));
  }

  function subBasic() {
    var power = el("section", "visual-card power-card");
    power.appendChild(el("div", "power-visual",
      '<div class="socket" role="img" aria-label="歐規 Type C、E、F 圓形雙孔插座示意">' +
        '<span class="socket-hole left"></span><span class="socket-hole right"></span>' +
        '<span class="earth top"></span><span class="earth bottom"></span></div>' +
      '<div class="plug" aria-hidden="true"><span class="plug-pin p1"></span>' +
        '<span class="plug-pin p2"></span></div>'));
    power.appendChild(el("div", "visual-copy",
      '<span class="visual-kicker">POWER</span><h3>230V・50Hz</h3>' +
      '<p><b>歐規圓形雙腳</b>，常見 C／E／F 型。請帶歐規轉接頭。</p>' +
      '<small>手機、相機與筆電充電器若標示 INPUT 100–240V，可直接使用；吹風機等高功率電器請先確認電壓。</small>'));
    view.appendChild(power);

    var t = el("table", "kv");
    D.practical.forEach(function (p) {
      var tr = el("tr");
      tr.appendChild(el("td", "k", esc(p.k)));
      tr.appendChild(el("td", null, esc(p.v)));
      t.appendChild(tr);
    });
    view.appendChild(t);
  }

  var TOUR_CONTACTS = [
    ["領隊", "莊和菊 小姐", "0927-916469"],
    ["導遊", "丁小鈴 小姐", "0928-121930"],
    ["禾掬旅行社", "服務電話", "06-3110660"]
  ];
  var PDF_NOTICES = [
    ["證件與集合", [
      "護照須確認效期與簽名，並將護照、機票及保險資料拍照備份；證件與現金分開保管。",
      "集合時間為 2026/9/26 20:30，桃園國際機場第一航廈中華航空櫃檯集合。",
      "團體旅遊請遵守領隊宣布的集合時間；若需離隊，務必先告知領隊。"
    ]],
    ["手提與託運行李", [
      "手提行李依航空公司規定辦理；液體、膠狀及噴霧容器單瓶不得超過 100 ml，集中放入透明夾鏈袋。",
      "託運行李每人 1 件、23 kg 內；刀具、剪刀與尖銳物品放入託運行李。",
      "貴重物品、證件、固定用藥及至少一晚換洗衣物請放隨身包，不要託運。"
    ]],
    ["行動電源與鋰電池", [
      "行動電源、備用鋰電池必須隨身攜帶，不可放入託運行李。",
      "行動電源容量標示須清楚，端子應做好防短路保護；機上依航空公司規定使用與收納。"
    ]],
    ["藥品與健康", [
      "每日固定用藥請攜帶足量並放在隨身行李；處方藥建議保留原包裝、處方箋或英文診斷證明。",
      "長途飛行請適時補水與活動腿部；如有特殊健康需求，出發前先諮詢醫師並通知領隊。"
    ]],
    ["海關與禁止攜帶物", [
      "返台勿攜帶肉類、含肉加工品或來源不明的動植物產品，以免觸犯非洲豬瘟及檢疫規定。",
      "攜帶大量現金、藥品、菸酒或其他受管制物品時，應依出入境海關現行規定申報。",
      "購買退稅商品後，請保存商品、收據及退稅單，以便離境查驗。"
    ]],
    ["旅途中安全", [
      "護照、現金與信用卡分散存放；觀光區、車站與大眾運輸上注意扒手。",
      "上下車及離開飯店前清點手機、護照、錢包與隨身包；歐盟共同緊急電話為 112。"
    ]]
  ];

  function tourContacts() {
    var box = el("section", "contact-box");
    TOUR_CONTACTS.forEach(function (c) {
      var row = el("div", "contact-row");
      row.appendChild(el("span", "contact-role", esc(c[0])));
      row.appendChild(el("strong", null, esc(c[1])));
      var a = el("a", "contact-phone", esc(c[2]));
      a.href = "tel:" + c[2].replace(/-/g, "");
      row.appendChild(a);
      box.appendChild(row);
    });
    return box;
  }

  function subTips() {
    view.appendChild(label("領隊・導遊・旅行社"));
    view.appendChild(tourContacts());
    view.appendChild(label("說明會 PDF 行程注意事項"));
    PDF_NOTICES.forEach(function (g, i) {
      var dt = el("details", "acc pdf-notice");
      if (i === 0) dt.open = true;
      dt.appendChild(el("summary", null, esc(g[0])));
      dt.appendChild(bullets(g[1]));
      view.appendChild(dt);
    });
    view.appendChild(label("其他旅行提醒"));
    view.appendChild(el("p", "hint", "點標題展開／收合。"));
    D.tips.forEach(function (g, i) {
      var dt = el("details", "acc");
      if (i === 0) dt.open = true;
      dt.appendChild(el("summary", null, esc(g.t)));
      dt.appendChild(bullets(g.items));
      view.appendChild(dt);
    });
  }

  function subPack() {
    var total = 0, done = 0;
    D.packingGroups.forEach(function (g, gi) {
      g.items.forEach(function (_, i) {
        total++; if (store("pk:" + gi + ":" + i) === "1") done++;
      });
    });

    var prog = el("div", "prog");
    function tally() {
      prog.textContent = "已勾 " + done + " / " + total + "　勾選只存在這台手機";
    }
    tally();
    view.appendChild(prog);

    var boxes = [];
    D.packingGroups.forEach(function (g, gi) {
      view.appendChild(label(g.g));
      var ul = el("ul", "check");
      g.items.forEach(function (item, i) {
        var key = "pk:" + gi + ":" + i;
        var li = el("li");
        var lab = el("label");
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = store(key) === "1";
        if (cb.checked) li.className = "done";
        cb.addEventListener("change", function () {
          store(key, cb.checked ? "1" : "0");
          li.classList.toggle("done", cb.checked);
          done += cb.checked ? 1 : -1;
          tally();                     // 只改這一列與計數，不重繪整頁
        });
        lab.appendChild(cb);
        lab.appendChild(el("span", null, esc(item)));
        li.appendChild(lab);
        ul.appendChild(li);
        boxes.push({ cb: cb, li: li, key: key });
      });
      view.appendChild(ul);
    });

    view.appendChild(label("整理行李小技巧"));
    view.appendChild(bullets(D.packingTips));

    var reset = el("button", "btn ghost", "清空所有勾選");
    reset.addEventListener("click", function () {
      if (!confirm("清空全部打包勾選？")) return;
      boxes.forEach(function (b) {
        store(b.key, "0");
        b.cb.checked = false;
        b.li.classList.remove("done");
      });
      done = 0;
      tally();
    });
    view.appendChild(reset);
  }

  function subFee() {
    view.appendChild(label("團費包含"));
    var t = el("table", "kv");
    D.fees.included.forEach(function (r) {
      var tr = el("tr");
      tr.appendChild(el("td", "k", esc(r[0])));
      tr.appendChild(el("td", null, esc(r[1])));
      t.appendChild(tr);
    });
    view.appendChild(t);
    view.appendChild(label("團費不包含"));
    view.appendChild(bullets(D.fees.excluded));
    view.appendChild(el("div", "box warn",
      '<b>艙等</b><span class="caveat">' + esc(D.fees.note) + "</span>"));
  }

  /* ══════════════════════════════════════════
     畫面：我的（全部只存在這台手機）
     ══════════════════════════════════════════ */
  var GROUPS = [
    ["訂位與證件", [
      ["pnr", "訂位代號（華航確認編號）", "input"],
      ["tkt1", "電子機票票號－本人", "input"],
      ["tkt2", "電子機票票號－同行", "input"],
      ["ff", "華航會員編號－本人", "input"],
      ["ff2", "華航會員編號－同行", "input"],
      ["mail", "訂位聯絡信箱", "input"],
      ["mobile", "訂位聯絡手機", "input"]
    ]],
    ["領隊與緊急聯絡", [
      ["lead", "領隊姓名與手機", "input"],
      ["agency", "旅行社 24 小時緊急電話", "input"],
      ["insure", "保險公司海外服務電話", "input"],
      ["card", "信用卡掛失電話", "input"]
    ]],
    ["房號與同行", [["room", "房號與分房", "textarea"]]],
    ["實際住宿", [["hotels", "確認後的實際旅館與電話", "textarea"]]],
    ["隨手筆記", [["notes", "筆記", "textarea"]]]
  ];

  function renderMine() {
    view.appendChild(head("我的", "Personale", "我的資料",
      ""));
    view.appendChild(el("div", "stave"));

    var gap = daysToGo();
    if (gap > 0) view.appendChild(el("div", "prog", "距離出發還有 " + gap + " 天"));

    view.appendChild(label("航班"));
    var ft = el("table", "kv");
    (D.meta.flights || []).forEach(function (f) {
      var tr = el("tr");
      tr.appendChild(el("td", "k", esc(f.no)));
      tr.appendChild(el("td", null, esc(f.date) + "　" + esc(f.dep) + " → " + esc(f.arr) +
        '<br><span class="dim">' + esc(f.dur) + "　" + esc(f.ac) + "</span>"));
      ft.appendChild(tr);
    });
    view.appendChild(ft);
    view.appendChild(el("p", "hint",
      "網路報到於起飛前 48 小時開放。團體票請先問領隊要不要統一劃位，別自己先選。"));

    view.appendChild(label("本團聯絡資料"));
    view.appendChild(tourContacts());

    GROUPS.forEach(function (g) {
      view.appendChild(label(g[0]));
      g[1].forEach(function (f) {
        var wrap = el("div", "field");
        var id = "f_" + f[0];
        var lb = el("label", null, esc(f[1]));
        lb.setAttribute("for", id);
        wrap.appendChild(lb);
        var input = document.createElement(f[2]);
        input.id = id;
        if (f[2] === "input") input.type = "text";
        input.value = store("my:" + f[0]) || "";
        input.addEventListener("input", function () { store("my:" + f[0], input.value); });
        wrap.appendChild(input);
        view.appendChild(wrap);
      });
    });

    view.appendChild(label("備份與轉移"));
    view.appendChild(el("p", "hint",
      "換手機、或要讓兩支手機內容一致時，在這支匯出成一個檔案，再到另一支匯入。" +
      "這個檔案含個資，請自己保管，別放進 GitHub。"));

    var row = el("div", "btnrow");

    var out = el("button", "btn", "匯出我的資料");
    out.addEventListener("click", function () {
      var o = {};
      GROUPS.forEach(function (g) {
        g[1].forEach(function (f) { o[f[0]] = store("my:" + f[0]) || ""; });
      });
      var blob = new Blob([JSON.stringify(o, null, 1)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "奧捷-我的資料.json";
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
    });

    var inLab = el("label", "btn ghost", "匯入");
    var file = document.createElement("input");
    file.type = "file"; file.accept = "application/json"; file.hidden = true;
    file.addEventListener("change", function () {
      var f = file.files && file.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        try {
          var o = JSON.parse(fr.result);
          Object.keys(o).forEach(function (k) { store("my:" + k, o[k]); });
          render();
        } catch (e) { alert("這個檔案讀不出來，請確認是本 App 匯出的 JSON。"); }
      };
      fr.readAsText(f);
    });
    inLab.appendChild(file);

    var clr = el("button", "btn ghost", "清除本機個資");
    clr.addEventListener("click", function () {
      if (!confirm("清除這台手機上「我的資料」全部欄位？打包勾選不受影響。")) return;
      GROUPS.forEach(function (g) {
        g[1].forEach(function (f) { store("my:" + f[0], ""); });
      });
      render();
    });

    row.appendChild(out); row.appendChild(inLab); row.appendChild(clr);
    view.appendChild(row);

    view.appendChild(el("p", "hint",
      "別在這裡放護照號碼或信用卡卡號。手機遺失時，這些欄位等同攤開給撿到的人。"));
  }

  /* ── 主渲染 ───────────────────────────── */
  function render(keepScroll) {
    var y = keepScroll ? window.pageYOffset : 0;
    view.innerHTML = "";
    if (tab === "days") renderDay();
    else if (tab === "cities") renderCities();
    else if (tab === "shop") renderShop();
    else if (tab === "info") renderInfo();
    else renderMine();
    markRail();
    if (keepScroll) window.scrollTo(0, y);
    else window.scrollTo(0, 0);
  }

  function syncTabs() {
    [].forEach.call(document.querySelectorAll(".tab"), function (b) {
      b.classList.toggle("is-on", b.dataset.tab === tab);
    });
  }
  [].forEach.call(document.querySelectorAll(".tab"), function (b) {
    b.addEventListener("click", function () { tab = b.dataset.tab; syncTabs(); render(); });
  });

  /* ── 啟動 ─────────────────────────────── */
  wxLoad();
  fetch("data/itinerary.json")
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .catch(function () {
      view.innerHTML = '<div class="box warn"><b>行程資料讀不到</b>' +
        '<span class="caveat">請確認 data/itinerary.json 與本頁在同一個資料夾，' +
        "並且是透過網址開啟（不能直接雙擊本機檔案）。</span></div>";
      return null;
    })
    .then(function (json) {
      if (!json) return;                     // 讀取失敗，訊息已顯示
      D = json;                              // 以下若出錯就讓它浮出來，不再假報成讀不到
      buildRail();
      render();
      // 國界底圖：拿到才重畫，拿不到就只畫路線，不影響其他功能
      fetch("data/borders.json")
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (b) { if (b && Array.isArray(b) && b.length) { BORDERS = b; render(); } })
        .catch(function () {});
      if (navigator.onLine && Date.now() - WX.at > 3 * 3600 * 1000) {
        wxFetch(function () { if (WX.data) render(); });
      }
    });

  if ("serviceWorker" in navigator) {
    addEventListener("load", function () { navigator.serviceWorker.register("sw.js"); });
  }
})();
