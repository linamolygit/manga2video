(function () {
  if (globalThis.__panelReelSaverReady) return;
  globalThis.__panelReelSaverReady = true;

  const ATTRS = [
    "src",
    "data-src",
    "data-original",
    "data-url",
    "data-lazy-src",
    "data-lazy",
    "data-image",
    "data-bg",
    "data-background",
    "data-src-large",
    "data-full",
  ];

  function parseSrcset(value) {
    if (!value) return [];
    return value
      .split(",")
      .map((part) => part.trim().split(/\s+/)[0])
      .filter(Boolean);
  }

  function resolve(raw) {
    if (!raw) return null;
    const t = String(raw).trim();
    if (!t || t.startsWith("data:image/svg")) return null;
    if (t.startsWith("data:image/")) return t;
    try {
      return new URL(t, document.baseURI).href;
    } catch {
      return null;
    }
  }

  function bgUrls(style) {
    if (!style) return [];
    const out = [];
    const re = /url\((['"]?)(.*?)\1\)/g;
    let m;
    while ((m = re.exec(style))) out.push(m[2]);
    return out;
  }

  function collect() {
    const seen = new Set();
    const items = [];

    const push = (raw, extra) => {
      const url = resolve(raw);
      if (!url || seen.has(url)) return;
      seen.add(url);
      items.push({
        url,
        width: extra?.width || 0,
        height: extra?.height || 0,
      });
    };

    // Reader pages mark each actual manga panel with this layout and a stable
    // fallback index. Avoid scanning artwork, avatars, logos, ads, and images
    // merely linked from the page.
    const readerImages = document.querySelectorAll(
      "img.block.object-contain.h-auto.w-full.max-w-3xl[data-fallback-index]",
    );

    for (const img of readerImages) {
      push(img.currentSrc || img.src, { width: img.naturalWidth, height: img.naturalHeight });
    }

    return items;

    for (const source of document.querySelectorAll("source")) {
      push(source.getAttribute("src"));
      for (const s of parseSrcset(source.getAttribute("srcset"))) push(s);
    }

    for (const el of document.querySelectorAll("[style*='url('], [data-bg], [data-background]")) {
      for (const u of bgUrls(el.getAttribute("style"))) push(u);
      push(el.getAttribute("data-bg"));
      push(el.getAttribute("data-background"));
    }

    for (const a of document.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href") || "";
      if (/\.(jpe?g|png|webp|gif|avif|bmp)(\?|#|$)/i.test(href)) push(href);
    }

    const og = document.querySelector('meta[property="og:image"]');
    if (og) push(og.getAttribute("content"));

    return items;
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "scan") {
      sendResponse({ ok: true, items: collect(), title: document.title, href: location.href });
      return;
    }

    if (msg?.type === "saveOne") {
      chrome.runtime.sendMessage({ type: "downloadOne", url: msg.url, index: msg.index ?? 0 })
        .then(sendResponse)
        .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
      return true;
    }

    if (msg?.type === "saveZip") {
      chrome.runtime.sendMessage({ type: "downloadZip", urls: msg.urls || collect().map((item) => item.url) })
        .then(sendResponse)
        .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
      return true;
    }
  });
})();
