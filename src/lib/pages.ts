export type PageSource = "file" | "url" | "html" | "sample";

export type MangaPage = {
  id: string;
  name: string;
  url: string;
  source: PageSource;
};

export function naturalNameSort(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function isImageFile(file: File) {
  if (file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|avif|bmp|jfif)$/i.test(file.name);
}

export function isHtmlFile(file: File) {
  if (file.type === "text/html") return true;
  return /\.html?$/i.test(file.name);
}

const IMAGE_PATH = /\.(jpe?g|png|webp|gif|avif|bmp)(\?|#|$)/i;

export function isDirectImageUrl(value: string) {
  try {
    const u = new URL(value);
    if (u.protocol === "data:") return value.startsWith("data:image/");
    if (u.protocol === "blob:") return true;
    return IMAGE_PATH.test(u.pathname);
  } catch {
    return false;
  }
}

function parseSrcset(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function resolveUrl(src: string, baseUrl?: string) {
  try {
    return new URL(src, baseUrl).href;
  } catch {
    return src;
  }
}

export function extractImageUrlsFromHtml(html: string, baseUrl?: string): string[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const found: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string | null) => {
    if (!raw) return;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("data:image/svg")) return;
    if (trimmed.startsWith("data:image/")) {
      if (!seen.has(trimmed)) {
        seen.add(trimmed);
        found.push(trimmed);
      }
      return;
    }
    const href = resolveUrl(trimmed, baseUrl);
    if (seen.has(href)) return;
    seen.add(href);
    found.push(href);
  };

  for (const img of Array.from(doc.querySelectorAll("img"))) {
    push(img.getAttribute("src"));
    push(img.getAttribute("data-src"));
    push(img.getAttribute("data-original"));
    push(img.getAttribute("data-url"));
    push(img.getAttribute("data-lazy-src"));
    push(img.getAttribute("data-image"));
    for (const s of parseSrcset(img.getAttribute("srcset"))) push(s);
    for (const s of parseSrcset(img.getAttribute("data-srcset"))) push(s);
  }

  for (const source of Array.from(doc.querySelectorAll("source"))) {
    push(source.getAttribute("src"));
    for (const s of parseSrcset(source.getAttribute("srcset"))) push(s);
  }

  for (const a of Array.from(doc.querySelectorAll("a[href]"))) {
    const href = a.getAttribute("href");
    if (href && IMAGE_PATH.test(href)) push(href);
  }

  return found;
}

export function splitPastedInput(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function looksLikeHtml(raw: string) {
  const t = raw.trim().toLowerCase();
  return t.startsWith("<!doctype") || t.startsWith("<html") || t.includes("<img");
}
