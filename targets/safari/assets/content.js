"use strict";
(() => {
  // supabase/functions/_shared/url-checks.ts
  var SHORTENERS = /* @__PURE__ */ new Set([
    "bit.ly",
    "tinyurl.com",
    "t.co",
    "goo.gl",
    "ow.ly",
    "is.gd",
    "buff.ly",
    "rebrand.ly",
    "cutt.ly",
    "shorturl.at",
    "rb.gy",
    "tiny.cc",
    "lnkd.in",
    "s.id",
    "v.gd",
    "qrco.de"
  ]);
  var RISKY_TLDS = /* @__PURE__ */ new Set([
    "top",
    "xyz",
    "icu",
    "click",
    "cfd",
    "sbs",
    "buzz",
    "rest",
    "zip",
    "mov",
    "cyou",
    "shop",
    "online",
    "site",
    "live",
    "vip",
    "win",
    "bond",
    "info",
    "today",
    "lol"
  ]);
  var BRANDS = {
    usps: ["usps.com"],
    ups: ["ups.com"],
    fedex: ["fedex.com"],
    dhl: ["dhl.com"],
    amazon: ["amazon.com", "amazon.co.uk", "amazon.ca", "amzn.to", "a.co", "amzn.com"],
    apple: ["apple.com", "apple.co"],
    icloud: ["icloud.com", "apple.com"],
    paypal: ["paypal.com"],
    venmo: ["venmo.com"],
    zelle: ["zellepay.com"],
    cashapp: ["cash.app"],
    netflix: ["netflix.com"],
    microsoft: ["microsoft.com", "live.com", "office.com"],
    chase: ["chase.com"],
    wellsfargo: ["wellsfargo.com"],
    bankofamerica: ["bankofamerica.com"],
    coinbase: ["coinbase.com"],
    irs: ["irs.gov"],
    ezpass: ["e-zpassny.com", "ezpassnj.com", "e-zpassiag.com"],
    google: ["google.com", "googleusercontent.com", "googleapis.com"],
    facebook: ["facebook.com"],
    instagram: ["instagram.com"],
    meta: ["meta.com"]
  };
  var OFFICIAL = new Set(Object.values(BRANDS).flat());
  var TWO_PART_SUFFIXES = /* @__PURE__ */ new Set(["co.uk", "com.au", "co.nz", "co.jp", "com.br", "co.in", "org.uk"]);
  function registrableDomain(host) {
    const parts = host.toLowerCase().split(".");
    const lastTwo = parts.slice(-2).join(".");
    return TWO_PART_SUFFIXES.has(lastTwo) ? parts.slice(-3).join(".") : lastTwo;
  }
  function looksShortened(u) {
    const name = registrableDomain(u.hostname).split(".")[0];
    const segs = u.pathname.split("/").filter(Boolean);
    if (OFFICIAL.has(registrableDomain(u.hostname))) return false;
    const t = segs[0] ?? "";
    const randomLooking = /\d/.test(t) || /[A-Z]/.test(t.slice(1)) && /[a-z]/.test(t) || /^[-_]/.test(t);
    return name.length <= 4 && segs.length === 1 && /^[A-Za-z0-9_-]{4,12}$/.test(t) && randomLooking && !u.search;
  }
  var isIp = (h) => /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.startsWith("[");
  function staticFlags(u) {
    const flags = [];
    const host = u.hostname.toLowerCase();
    const reg = registrableDomain(host);
    const tld = host.split(".").pop() ?? "";
    if (u.protocol === "http:") flags.push("Not encrypted (http, not https)");
    if (isIp(host)) flags.push("Uses a raw IP address instead of a website name");
    if (host.includes("xn--")) flags.push("Uses look-alike international characters in the address");
    if (SHORTENERS.has(host) || looksShortened(u)) flags.push("Shortened link hides the real destination");
    if (RISKY_TLDS.has(tld)) flags.push(`Ends in \u201C.${tld}\u201D, an ending often used by scam sites`);
    if (u.username || u.href.includes("@")) flags.push("Contains \u201C@\u201D, which can disguise the real destination");
    if (host.split(".").length > 4) flags.push("Unusually long chain of subdomains");
    if ((host.match(/-/g) ?? []).length >= 3) flags.push("Many hyphens in the website name");
    const tokens = host.split(/[.-]/);
    for (const [brand, official] of Object.entries(BRANDS)) {
      const mentions = tokens.some((t) => t === brand || brand.length >= 6 && t.includes(brand));
      if (mentions && !official.includes(reg)) {
        flags.push(`Mentions \u201C${brand}\u201D but isn\u2019t ${brand}\u2019s official website (${official[0]})`);
        break;
      }
    }
    return flags;
  }
  var SEVERE = [/look-alike/, /raw IP/, /isn’t .* official website/, /“@”/];
  var isSevere = (flag) => SEVERE.some((re) => re.test(flag));

  // extensions/safari-content.ts
  var PHRASES = {
    usps: ["USPS", "U.S. Postal Service"],
    ups: ["UPS My Choice"],
    fedex: ["FedEx"],
    dhl: ["DHL Express"],
    amazon: ["Amazon"],
    apple: ["Apple ID", "Apple Account"],
    icloud: ["iCloud"],
    paypal: ["PayPal"],
    venmo: ["Venmo"],
    zelle: ["Zelle"],
    cashapp: ["Cash App"],
    netflix: ["Netflix"],
    microsoft: ["Microsoft account", "Outlook", "Office 365"],
    chase: ["Chase Online", "Chase Bank", "JPMorgan Chase"],
    wellsfargo: ["Wells Fargo"],
    bankofamerica: ["Bank of America"],
    coinbase: ["Coinbase"],
    irs: ["IRS", "Internal Revenue Service"],
    ezpass: ["E-ZPass", "EZPass"],
    google: ["Google Account", "Gmail"],
    facebook: ["Facebook"],
    instagram: ["Instagram"],
    meta: ["Meta Business"]
  };
  var DISMISS_KEY = "lens-dismissed";
  function pageText() {
    const og = document.querySelector('meta[property="og:site_name"]')?.getAttribute("content") ?? "";
    const h1 = document.querySelector("h1")?.textContent ?? "";
    const logoAlt = Array.from(document.querySelectorAll("img[alt]")).slice(0, 5).map((i) => i.getAttribute("alt")).join(" ");
    return `${document.title} ${og} ${h1} ${logoAlt}`;
  }
  function asksForSecrets() {
    return !!document.querySelector(
      'input[type="password"], input[autocomplete^="cc-"], input[name*="card" i], input[id*="card" i], input[name*="cvv" i], input[name*="ssn" i]'
    );
  }
  function impersonatedBrand(host) {
    const reg = registrableDomain(host);
    const text = pageText();
    if (Object.values(BRANDS).some((official) => official.includes(reg))) return null;
    for (const phrases of Object.values(PHRASES)) {
      for (const phrase of phrases) {
        const re = new RegExp(`(^|[^A-Za-z])${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Za-z]|$)`);
        if (re.test(text)) return phrases[0] === "Apple ID" ? "Apple" : phrases[0];
      }
    }
    return null;
  }
  function reasonsFor(url) {
    const reasons = staticFlags(url).filter(isSevere);
    if (asksForSecrets()) {
      const brand = impersonatedBrand(url.hostname);
      if (brand) reasons.push(`This page looks like ${brand} and asks for your details, but it isn\u2019t ${brand}\u2019s real website.`);
    }
    return reasons;
  }
  var shown = false;
  function showBanner(reasons) {
    shown = true;
    const host = document.createElement("div");
    host.style.cssText = "all:initial;position:fixed;inset:0 0 auto 0;z-index:2147483647;";
    const root = host.attachShadow({ mode: "closed" });
    root.innerHTML = `
    <style>
      .b{font:16px/1.4 -apple-system,system-ui,sans-serif;background:#1a0707;color:#fff;border-bottom:3px solid #FF5A5F;
         padding:16px 18px calc(16px + env(safe-area-inset-top));box-shadow:0 8px 30px #000a}
      .t{font-weight:800;font-size:19px;color:#FF5A5F;margin:0 0 6px}
      ul{margin:6px 0 12px;padding-left:20px} li{margin:4px 0}
      .row{display:flex;gap:10px} button{flex:1;font:600 16px -apple-system,system-ui;border:0;border-radius:12px;padding:12px}
      .leave{background:#2BF5A4;color:#04140C} .stay{background:#2a2e2a;color:#ddd}
      .s{opacity:.75;font-size:13px;margin-top:8px}
    </style>
    <div class="b" role="alert">
      <p class="t">\u26A0\uFE0E LENS: this may be a scam website</p>
      <ul>${reasons.map((r) => `<li>${r.replace(/[<>&]/g, "")}</li>`).join("")}</ul>
      <div class="row"><button class="leave">Get me out of here</button><button class="stay">I trust this site</button></div>
      <div class="s">Don\u2019t enter passwords, card numbers or codes here. If you need the real company, type its address yourself.</div>
    </div>`;
    root.querySelector(".leave").addEventListener("click", () => {
      if (history.length > 1) history.back();
      else location.href = "about:blank";
    });
    root.querySelector(".stay").addEventListener("click", () => {
      try {
        sessionStorage.setItem(DISMISS_KEY, "1");
      } catch {
      }
      host.remove();
    });
    document.documentElement.appendChild(host);
  }
  function run() {
    try {
      if (sessionStorage.getItem(DISMISS_KEY)) return;
    } catch {
    }
    let url;
    try {
      url = new URL(location.href);
    } catch {
      return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return;
    const reasons = reasonsFor(url);
    if (reasons.length) showBanner(reasons);
  }
  run();
  setTimeout(() => {
    if (!shown) run();
  }, 2500);
})();
