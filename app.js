/* Product hub — reads products from a Google Sheet (CSV) and renders them.
   You don't need to edit this file. Settings are in config.js. */
(function () {
  "use strict";
  var C = Object.assign({
    name: "", bio: "", avatar: "", sheetCsvUrl: "", currency: "ر.س",
    showTelegramBanner: true, goatcounterCode: "", newBadgeDays: 3, accent: ""
  }, window.SITE_CONFIG || {});

  var $ = function (id) { return document.getElementById(id); };
  var CACHE_KEY = "hub_csv_v1";
  var state = { all: [], filter: "all", q: "", deepCode: null };

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function safeUrl(u) {
    u = String(u || "").trim();
    return /^https?:\/\//i.test(u) ? u : "";
  }
  // Arabic-Indic & Persian digits → 0-9
  function latinDigits(s) {
    return String(s).replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 1632; })
                    .replace(/[۰-۹]/g, function (d) { return d.charCodeAt(0) - 1776; });
  }
  // normalise Arabic for forgiving search
  function norm(s) {
    return latinDigits(String(s || "")).toLowerCase()
      .replace(/[ً-ٰٟـ]/g, "")
      .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
      .replace(/\s+/g, " ").trim();
  }
  function num(v) {
    var n = parseFloat(latinDigits(String(v || "")).replace(/[^\d.]/g, ""));
    return isFinite(n) ? n : null;
  }
  function yes(v) { return /^(yes|y|true|1|نعم|اي|ايوه|✓|✔|x)$/i.test(String(v || "").trim()); }
  function no(v) { return /^(no|n|false|0|لا|مخفي|hide|hidden)$/i.test(String(v || "").trim()); }
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 1800);
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* ---------- CSV ---------- */
  function parseCSV(text) {
    var rows = [], row = [], f = "", q = false, i = 0, c;
    text = String(text).replace(/^﻿/, "");
    for (; i < text.length; i++) {
      c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(f); f = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(f); rows.push(row); row = []; f = "";
      } else f += c;
    }
    if (f !== "" || row.length) { row.push(f); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return String(x).trim() !== ""; }); });
  }

  // Header names accepted (English or Arabic)
  var ALIASES = {
    code: ["code", "رقم", "الرقم", "رقم المنتج", "#", "no"],
    title: ["title", "name", "الاسم", "اسم المنتج", "المنتج", "العنوان"],
    image: ["image", "img", "photo", "الصورة", "صورة", "رابط الصورة"],
    price: ["price", "السعر", "السعر الحالي", "سعر"],
    old_price: ["old_price", "oldprice", "old price", "السعر القديم", "السعر قبل", "قبل الخصم"],
    currency: ["currency", "العملة"],
    store: ["store", "shop", "المتجر", "الموقع"],
    category: ["category", "cat", "القسم", "التصنيف", "الفئة"],
    link: ["link", "url", "affiliate", "الرابط", "رابط", "رابط الشراء"],
    badge: ["badge", "label", "شارة", "الشارة", "ملاحظة"],
    featured: ["featured", "hot", "مميز", "مميزة"],
    active: ["active", "show", "visible", "ظاهر", "فعال", "عرض"],
    added: ["added", "date", "التاريخ", "تاريخ الإضافة"]
  };
  function mapHeaders(hdr) {
    var map = {};
    hdr.forEach(function (h, i) {
      var k = norm(h).replace(/_/g, " ");
      Object.keys(ALIASES).forEach(function (key) {
        if (map[key] != null) return;
        if (ALIASES[key].some(function (a) { return norm(a).replace(/_/g, " ") === k; })) map[key] = i;
      });
    });
    return map;
  }
  function detectStore(store, link) {
    var s = norm(store) + " " + String(link).toLowerCase();
    if (/amazon|amzn|امازون/.test(s)) return "amazon";
    if (/aliexpress|ali ?express|علي ?اكسبرس|علي ?إكسبرس/.test(s)) return "aliexpress";
    if (/noon|نون/.test(s)) return "noon";
    if (/shein|شي ?ان/.test(s)) return "shein";
    return "other";
  }
  var STORE = {
    amazon: { name: "أمازون", buy: "اطلب من أمازون" },
    aliexpress: { name: "علي إكسبريس", buy: "اطلب من علي إكسبريس" },
    noon: { name: "نون", buy: "اطلب من نون" },
    shein: { name: "شي إن", buy: "اطلب من شي إن" },
    other: { name: "متجر", buy: "اطلب الآن" }
  };

  function toProducts(text) {
    var rows = parseCSV(text);
    if (rows.length < 2) return [];
    var m = mapHeaders(rows[0]);
    var get = function (r, k) { return m[k] == null ? "" : String(r[m[k]] || "").trim(); };
    var now = Date.now(), newMs = (Number(C.newBadgeDays) || 0) * 864e5;
    return rows.slice(1).map(function (r, idx) {
      var link = safeUrl(get(r, "link"));
      var added = Date.parse(latinDigits(get(r, "added")));
      var p = {
        idx: idx,
        code: latinDigits(get(r, "code")).replace(/^#/, ""),
        title: get(r, "title"),
        image: safeUrl(get(r, "image")) || (/^[\w\-./]+\.(jpe?g|png|webp|gif|avif)$/i.test(get(r, "image")) && get(r, "image").indexOf("..") < 0 ? get(r, "image") : ""),
        price: get(r, "price"),
        old: get(r, "old_price"),
        currency: get(r, "currency") || C.currency,
        store: detectStore(get(r, "store"), link),
        category: get(r, "category"),
        link: link,
        badge: get(r, "badge"),
        featured: yes(get(r, "featured")),
        active: !no(get(r, "active")),
        added: isFinite(added) ? added : null
      };
      p.isNew = p.added != null && newMs > 0 && now - p.added < newMs && p.added <= now + 864e5;
      var pn = num(p.price), on = num(p.old);
      p.off = pn != null && on != null && on > pn ? Math.round((1 - pn / on) * 100) : 0;
      p.search = norm([p.code, p.title, p.category, p.badge, STORE[p.store].name].join(" "));
      return p;
    }).filter(function (p) { return p.active && p.link && (p.title || p.code); })
      .sort(function (a, b) {              // newest first: by date, then by row (lower rows = newer)
        if (a.added != null && b.added != null && a.added !== b.added) return b.added - a.added;
        return b.idx - a.idx;
      });
  }

  /* ---------- rendering ---------- */
  var ICONS = {
    tiktok: '<svg viewBox="0 0 24 24"><path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>',
    telegram: '<svg viewBox="0 0 24 24"><path d="M11.94 0A12 12 0 1 0 12 0h-.06zm4.97 7.22c.1 0 .32.02.46.14.12.1.16.23.17.33.02.09.04.3.02.47-.18 1.9-.96 6.5-1.36 8.63-.17.9-.5 1.2-.82 1.23-.7.06-1.23-.46-1.9-.9-1.06-.7-1.65-1.13-2.68-1.8-1.18-.78-.41-1.21.26-1.91.18-.18 3.25-2.98 3.31-3.23 0-.03.01-.15-.06-.21s-.17-.04-.25-.02c-.1.02-1.79 1.14-5.06 3.34-.48.33-.91.49-1.3.48-.43-.01-1.25-.24-1.87-.44-.75-.24-1.35-.37-1.3-.79.03-.22.33-.44.9-.66 3.5-1.52 5.83-2.53 7-3.01 3.33-1.39 4.02-1.63 4.48-1.64z"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.4l-5.8-7.59-6.64 7.59H.47l8.6-9.83L0 1.15h7.6l5.24 6.93zm-1.29 19.5h2.04L6.49 3.24H4.3z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" style="fill:none;stroke:currentColor;stroke-width:2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
    snapchat: '<span style="font-size:20px">👻</span>',
    whatsapp: '<span style="font-size:20px">💬</span>'
  };
  var SOCIAL_LABEL = { tiktok: "تيك توك", telegram: "تيليجرام", instagram: "إنستغرام", snapchat: "سناب شات", x: "إكس", whatsapp: "واتساب" };

  function renderProfile() {
    if (C.accent) document.documentElement.style.setProperty("--accent", C.accent);
    $("name").textContent = C.name;
    $("bio").textContent = C.bio;
    if (C.name) document.title = C.name + " — روابط المنتجات";
    var av = $("avatar"), img = safeUrl(C.avatar) || (/^[\w\-./]+\.(jpe?g|png|webp|gif|avif|svg)$/i.test(C.avatar || "") && String(C.avatar).indexOf("..") < 0 ? C.avatar : "");
    if (img) av.innerHTML = '<img src="' + esc(img) + '" alt="' + esc(C.name) + '" width="136" height="136" fetchpriority="high">';
    else av.textContent = (C.name || "🛍").trim().charAt(0);
    $("socials").innerHTML = Object.keys(ICONS).map(function (k) {
      var u = safeUrl(C[k]);
      return u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener" aria-label="' + SOCIAL_LABEL[k] + '" data-social="' + k + '">' + ICONS[k] + "</a>" : "";
    }).join("");
    var tg = safeUrl(C.telegram);
    if (tg && C.showTelegramBanner) { $("tgBanner").href = tg; $("tgBanner").hidden = false; }
  }

  function renderChips() {
    var all = state.all, chips = [{ id: "all", label: "الكل" }];
    if (all.some(function (p) { return p.featured; })) chips.push({ id: "hot", label: "🔥 المميزة" });
    if (all.some(function (p) { return p.isNew; })) chips.push({ id: "new", label: "🆕 جديد" });
    if (all.some(function (p) { return p.off >= 30; })) chips.push({ id: "deal", label: "💸 خصم +30%" });
    var stores = {};
    all.forEach(function (p) { stores[p.store] = 1; });
    if (Object.keys(stores).length > 1) Object.keys(stores).forEach(function (s) {
      chips.push({ id: "store:" + s, label: STORE[s].name });
    });
    var cats = [];
    all.forEach(function (p) { if (p.category && cats.indexOf(p.category) < 0) cats.push(p.category); });
    cats.forEach(function (c) { chips.push({ id: "cat:" + c, label: c }); });
    if (!chips.some(function (c) { return c.id === state.filter; })) state.filter = "all";
    $("chips").innerHTML = chips.map(function (c) {
      return '<button class="chip" role="tab" data-f="' + esc(c.id) + '" aria-selected="' + (c.id === state.filter) + '">' + esc(c.label) + "</button>";
    }).join("");
  }

  function matches(p) {
    var f = state.filter;
    if (f === "hot" && !p.featured) return false;
    if (f === "new" && !p.isNew) return false;
    if (f === "deal" && p.off < 30) return false;
    if (f.indexOf("store:") === 0 && p.store !== f.slice(6)) return false;
    if (f.indexOf("cat:") === 0 && p.category !== f.slice(4)) return false;
    return true;
  }

  function fmtPrice(v, cur) {
    if (!v) return "";
    return /^[\d.,٠-٩\s]+$/.test(v) ? esc(v) + " " + esc(cur) : esc(v);
  }

  function card(p) {
    var s = STORE[p.store];
    var tag = p.badge ? '<span class="tag">' + esc(p.badge) + "</span>" : p.isNew ? '<span class="tag new">جديد</span>' : "";
    return '<article class="card" id="p-' + esc(p.code || p.idx) + '">' +
      '<a class="thumb" href="' + esc(p.link) + '" target="_blank" rel="sponsored noopener" data-buy="' + p.idx + '">' +
        '<span class="ph">🛍️</span>' +
        (p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.title) + '" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">' : "") +
        (p.code ? '<span class="code">#' + esc(p.code) + "</span>" : "") +
        (p.off ? '<span class="off">-' + p.off + "%</span>" : "") + tag +
      "</a>" +
      '<div class="body">' +
        '<span class="store ' + p.store + '"><i></i>' + s.name + "</span>" +
        '<h2 class="title">' + esc(p.title) + "</h2>" +
        (p.price ? '<div class="price"><b>' + fmtPrice(p.price, p.currency) + "</b>" + (p.old ? "<s>" + fmtPrice(p.old, p.currency) + "</s>" : "") + "</div>" : "") +
        '<div class="actions">' +
          '<a class="buy ' + p.store + '" href="' + esc(p.link) + '" target="_blank" rel="sponsored noopener" data-buy="' + p.idx + '"><span class="short">اطلب الآن 🛒</span><span class="long">' + s.buy + "</span></a>" +
          '<button class="share" data-share="' + p.idx + '" aria-label="مشاركة"><svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg></button>' +
        "</div>" +
      "</div></article>";
  }

  function render() {
    var q = norm(state.q).replace(/^#/, "");
    var isCode = /^\d+$/.test(q);
    var list = state.all.filter(matches);
    if (q) {
      var exact = isCode ? state.all.filter(function (p) { return p.code === q; }) : [];
      list = exact.length ? exact : state.all.filter(function (p) {
        return q.split(" ").every(function (w) { return p.search.indexOf(w) >= 0; });
      });
    }
    $("grid").innerHTML = list.map(card).join("");
    $("grid").classList.toggle("single", list.length === 1 && !!q);
    $("empty").hidden = list.length > 0 || !state.loaded;
    // notice when viewing a single searched/deep-linked product
    var n = $("notice");
    if (q && list.length) {
      n.innerHTML = "<span>" + (isCode && list.length === 1 ? "المنتج رقم <b><bdi>#" + esc(q) + "</bdi></b> 👇" : "نتائج البحث: " + list.length) +
        '</span><button type="button" id="showAll">عرض كل المنتجات</button>';
      n.hidden = false;
    } else n.hidden = true;
  }

  /* ---------- events ---------- */
  function byIdx(i) { i = Number(i); return state.all.filter(function (p) { return p.idx === i; })[0]; }
  function track(path, title) {
    try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: path, title: title || path, event: true }); } catch (e) {}
  }
  function productUrl(p) {
    return location.origin + location.pathname + (p.code ? "?p=" + encodeURIComponent(p.code) : "");
  }
  function setQuery(v, push) {
    state.q = v; $("q").value = v; render();
    if (push !== false) {
      try {
        var code = latinDigits(v).replace(/^#/, "").trim();
        history.replaceState(null, "", /^\d+$/.test(code) ? "?p=" + code : location.pathname);
      } catch (e) {}
    }
  }

  function bind() {
    var t;
    $("q").addEventListener("input", function (e) {
      clearTimeout(t); var v = e.target.value;
      t = setTimeout(function () { setQuery(v); if (v) track("search/" + norm(v).slice(0, 40)); }, 160);
    });
    $("q").addEventListener("keydown", function (e) { if (e.key === "Enter") e.target.blur(); });
    $("chips").addEventListener("click", function (e) {
      var b = e.target.closest(".chip"); if (!b) return;
      state.filter = b.getAttribute("data-f");
      [].forEach.call(document.querySelectorAll(".chip"), function (c) { c.setAttribute("aria-selected", c === b); });
      if (state.q) setQuery(""); else render();
      b.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    });
    $("notice").addEventListener("click", function (e) { if (e.target.id === "showAll") { setQuery(""); state.filter = "all"; renderChips(); render(); } });
    document.addEventListener("click", function (e) {
      var a = e.target.closest("[data-buy]");
      if (a) { var p = byIdx(a.getAttribute("data-buy")); if (p) track("click/" + p.store + "/" + (p.code || p.idx), p.title); return; }
      var s = e.target.closest("[data-social]");
      if (s) { track("social/" + s.getAttribute("data-social")); return; }
      if (e.target.closest("#tgBanner")) { track("social/telegram-banner"); return; }
      var sh = e.target.closest("[data-share]");
      if (sh) {
        var pr = byIdx(sh.getAttribute("data-share")); if (!pr) return;
        var url = productUrl(pr), text = pr.title + (pr.price ? " — " + pr.price + " " + pr.currency : "");
        track("share/" + (pr.code || pr.idx));
        if (navigator.share) navigator.share({ title: pr.title, text: text, url: url }).catch(function () {});
        else if (navigator.clipboard) navigator.clipboard.writeText(text + "\n" + url).then(function () { toast("تم نسخ الرابط ✅"); }, function () { prompt("انسخ الرابط:", url); });
        else prompt("انسخ الرابط:", url);
      }
    });
  }

  /* ---------- data loading ---------- */
  function sheetUrl(u) {
    u = String(u || "").trim();
    if (!u) return "products.csv";
    // Accept a normal "share" link too: convert to CSV export
    var m = u.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/);
    if (m && u.indexOf("/d/e/") < 0 && u.indexOf("output=csv") < 0) {
      var gid = (u.match(/[#&?]gid=(\d+)/) || [])[1];
      return "https://docs.google.com/spreadsheets/d/" + m[1] + "/gviz/tq?tqx=out:csv" + (gid ? "&gid=" + gid : "");
    }
    return u;
  }
  function apply(text) {
    var list = toProducts(text);
    state.all = list; state.loaded = true;
    renderChips(); render();
    if (state.deepCode) {
      var el = document.getElementById("p-" + state.deepCode);
      if (el) { el.classList.add("hl"); setTimeout(function () { $("notice").scrollIntoView({ block: "start", behavior: "smooth" }); }, 250); }
      state.deepCode = null;
    }
    return list.length;
  }
  function load() {
    var cached = lsGet(CACHE_KEY);
    if (cached) apply(cached);
    var url = sheetUrl(C.sheetCsvUrl);
    url += (url.indexOf("?") < 0 ? "?" : "&") + "_=" + Math.floor(Date.now() / 60000); // refresh every minute
    fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.text();
    }).then(function (text) {
      if (/^\s*</.test(text)) throw new Error("not csv"); // got an HTML page — sheet not published
      if (text !== cached) { apply(text); lsSet(CACHE_KEY, text); }
    }).catch(function (err) {
      // Sheet unreachable: fall back to the backup products.csv in this folder
      if (!cached && C.sheetCsvUrl && !load._fb) {
        load._fb = true;
        return fetch("products.csv", { cache: "no-store" }).then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); })
          .then(function (t) { if (!/^\s*</.test(t)) apply(t); else throw 0; })
          .catch(function () { showLoadError(url, err); });
      }
      if (!cached) showLoadError(url, err);
    });
  }
  function showLoadError(url, err) {
    {
      {
        state.loaded = true; $("grid").innerHTML = "";
        $("empty").hidden = false;
        $("empty").textContent = "تعذّر تحميل المنتجات. حدّث الصفحة بعد قليل 🙏";
        if (window.console) console.warn("Products failed to load from", url, err,
          "— check that the Google Sheet is published to the web as CSV (see GUIDE).");
      }
    }
  }

  function analytics() {
    var code = String(C.goatcounterCode || "").trim().replace(/[^a-z0-9-]/gi, "");
    if (!code) return;
    var s = document.createElement("script");
    s.async = true; s.src = "https://gc.zgo.at/count.js";
    s.setAttribute("data-goatcounter", "https://" + code + ".goatcounter.com/count");
    document.head.appendChild(s);
  }

  /* ---------- start ---------- */
  var params = new URLSearchParams(location.search);
  var deep = latinDigits(params.get("p") || params.get("code") || location.hash.replace(/^#/, "") || "").replace(/^#/, "").trim();
  if (deep) { state.q = deep; $("q").value = deep; state.deepCode = deep; }
  renderProfile(); bind(); analytics(); load();
})();
