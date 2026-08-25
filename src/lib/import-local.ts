import { unzipSync } from "fflate";
import {
  extractImageUrlsFromHtml,
  isDirectImageUrl,
  isHtmlFile,
  isImageFile,
  looksLikeHtml,
  naturalNameSort,
  splitPastedInput,
  type MangaPage,
  type PageSource,
} from "./pages";

function newId() {
  return crypto.randomUUID();
}

async function blobToPage(blob: Blob, name: string, source: PageSource): Promise<MangaPage> {
  const url = URL.createObjectURL(blob);
  return { id: newId(), name, url, source };
}

async function fetchAsBlob(url: string): Promise<Blob> {
  const res = await fetch(url, { mode: "cors", credentials: "omit" });
  if (!res.ok) {
    throw new Error(`Could not load ${url} (${res.status})`);
  }
  return res.blob();
}

export type ImportResult = {
  pages: MangaPage[];
  warnings: string[];
};

const ZIP_MAX_BYTES = 100 * 1024 * 1024;
const ZIP_MAX_FILES = 500;
const ZIP_MAX_EXTRACTED_BYTES = 250 * 1024 * 1024;

function isZipFile(file: File) {
  return file.type === "application/zip" || /\.zip$/i.test(file.name);
}

function imageMimeType(name: string) {
  const extension = name.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    avif: "image/avif",
    bmp: "image/bmp",
    jfif: "image/jpeg",
  };
  return types[extension ?? ""] ?? "application/octet-stream";
}

function isImageEntry(name: string) {
  return /\.(jpe?g|png|webp|gif|avif|bmp|jfif)$/i.test(name);
}

async function splitTallImage(blob: Blob, mimeType: string): Promise<Blob[]> {
  const image = await createImageBitmap(blob);
  const sourceWidth = image.width;
  const sourceHeight = image.height;
  if (sourceHeight / sourceWidth < 1.8) {
    image.close();
    return [blob];
  }

  const scanWidth = Math.min(700, sourceWidth);
  const scanHeight = Math.max(1, Math.round(sourceHeight * (scanWidth / sourceWidth)));
  const scan = document.createElement("canvas");
  scan.width = scanWidth;
  scan.height = scanHeight;
  const scanContext = scan.getContext("2d", { willReadFrequently: true });
  if (!scanContext) {
    image.close();
    return [blob];
  }
  scanContext.drawImage(image, 0, 0, scanWidth, scanHeight);
  const pixels = scanContext.getImageData(0, 0, scanWidth, scanHeight).data;
  const gapMinimum = Math.max(14, Math.round(scanHeight * 0.0025));
  const cuts: number[] = [];
  let gapStart = -1;

  for (let y = 0; y < scanHeight; y += 1) {
    let blankPixels = 0;
    for (let x = 0; x < scanWidth; x += 6) {
      const offset = (y * scanWidth + x) * 4;
      const red = pixels[offset];
      const green = pixels[offset + 1];
      const blue = pixels[offset + 2];
      if (red > 245 && green > 245 && blue > 245) blankPixels += 1;
    }
    const isBlankRow = blankPixels / Math.ceil(scanWidth / 6) > 0.985;
    if (isBlankRow && gapStart < 0) gapStart = y;
    if ((!isBlankRow || y === scanHeight - 1) && gapStart >= 0) {
      const gapEnd = isBlankRow ? y + 1 : y;
      if (gapEnd - gapStart >= gapMinimum) {
        const cut = Math.round(((gapStart + gapEnd) / 2 / scanHeight) * sourceHeight);
        if (cut > sourceHeight * 0.03 && cut < sourceHeight * 0.97) cuts.push(cut);
      }
      gapStart = -1;
    }
  }

  image.close();
  if (!cuts.length) return [blob];

  const boundaries = [0, ...cuts, sourceHeight];
  const slices: Blob[] = [];
  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const top = boundaries[i];
    const bottom = boundaries[i + 1];
    if (bottom - top < sourceHeight * 0.08) continue;
    const slice = document.createElement("canvas");
    slice.width = sourceWidth;
    slice.height = bottom - top;
    const context = slice.getContext("2d");
    if (!context) continue;
    const sliceImage = await createImageBitmap(blob, 0, top, sourceWidth, bottom - top);
    context.drawImage(sliceImage, 0, 0);
    sliceImage.close();
    const output = await new Promise<Blob | null>((resolve) =>
      slice.toBlob(resolve, mimeType),
    );
    if (output) slices.push(output);
  }
  return slices.length > 1 ? slices : [blob];
}

async function importZipFile(file: File): Promise<ImportResult> {
  const warnings: string[] = [];
  const pages: MangaPage[] = [];
  if (file.size > ZIP_MAX_BYTES) {
    return { pages, warnings: [`Skipped ${file.name}: ZIP files must be 100 MB or smaller.`] };
  }

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    return { pages, warnings: [`Could not open ${file.name} as a ZIP archive.`] };
  }

  const imageEntries = Object.entries(entries)
    .filter(([name]) => isImageEntry(name) && !name.endsWith("/"))
    .sort(([left], [right]) => naturalNameSort(left, right));

  if (!imageEntries.length) {
    return { pages, warnings: [`No supported images found inside ${file.name}.`] };
  }
  if (imageEntries.length > ZIP_MAX_FILES) {
    return { pages, warnings: [`Skipped ${file.name}: ZIP files may contain at most ${ZIP_MAX_FILES} images.`] };
  }

  let extractedBytes = 0;
  for (const [name, bytes] of imageEntries) {
    extractedBytes += bytes.byteLength;
    if (extractedBytes > ZIP_MAX_EXTRACTED_BYTES) {
      warnings.push(`${file.name}: stopped after ${pages.length} images (250 MB extracted limit).`);
      break;
    }
    const imageBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const mimeType = imageMimeType(name);
    const blob = new Blob([imageBuffer], { type: mimeType });
    const slices = await splitTallImage(blob, mimeType);
    for (const [index, slice] of slices.entries()) {
      const suffix = slices.length > 1 ? ` · page-${String(index + 1).padStart(2, "0")}` : "";
      pages.push(await blobToPage(slice, `${file.name} · ${name}${suffix}`, "file"));
    }
  }

  return { pages, warnings };
}
export async function importFiles(fileList: FileList | File[]): Promise<ImportResult> {
  const files = Array.from(fileList);
  const warnings: string[] = [];
  const pages: MangaPage[] = [];

  const images = files.filter(isImageFile).sort((a, b) => naturalNameSort(a.name, b.name));
  const htmlFiles = files.filter(isHtmlFile);
  const zipFiles = files.filter(isZipFile).sort((a, b) => naturalNameSort(a.name, b.name));

  for (const file of images) {
    pages.push(await blobToPage(file, file.name, "file"));
  }

  for (const zip of zipFiles) {
    const extracted = await importZipFile(zip);
    pages.push(...extracted.pages);
    warnings.push(...extracted.warnings);
  }

  for (const html of htmlFiles) {
    const text = await html.text();
    const urls = extractImageUrlsFromHtml(text);
    const dataUris = urls.filter((u) => u.startsWith("data:image/"));
    const remote = urls.filter((u) => !u.startsWith("data:"));

    for (const [i, data] of dataUris.entries()) {
      const res = await fetch(data);
      const blob = await res.blob();
      pages.push(await blobToPage(blob, `${html.name} · ${i + 1}`, "html"));
    }

    const byName = new Map(images.map((f) => [f.name, f]));
    let matched = 0;
    for (const url of remote) {
      let path = url;
      try {
        path = decodeURIComponent(new URL(url, "https://local.invalid").pathname);
      } catch {
        /* keep */
      }
      const base = path.split("/").pop() ?? "";
      const local = byName.get(base);
      if (local) {
        matched += 1;
        continue;
      }
    }

    if (remote.length && matched < remote.length && dataUris.length === 0) {
      const loaded = await loadRemoteUrls(remote, "html");
      pages.push(...loaded.pages);
      warnings.push(...loaded.warnings);
    }
  }

  if (!pages.length) {
    warnings.push("No images found in those files.");
  }

  return { pages, warnings };
}

export async function loadRemoteUrls(
  urls: string[],
  source: PageSource = "url",
): Promise<ImportResult> {
  const pages: MangaPage[] = [];
  const warnings: string[] = [];

  for (const [i, url] of urls.entries()) {
    try {
      const blob = await fetchAsBlob(url);
      if (!blob.type.startsWith("image/") && !isDirectImageUrl(url)) {
        warnings.push(`Skipped (not an image): ${url}`);
        continue;
      }
      let name = `image-${i + 1}`;
      try {
        name = decodeURIComponent(new URL(url).pathname.split("/").pop() || name);
      } catch {
        /* keep */
      }
      pages.push(await blobToPage(blob, name, source));
    } catch {
      warnings.push(
        `Blocked in the browser: ${shortUrl(url)}. Reader sites usually deny this. Drop the files you already downloaded instead.`,
      );
    }
  }

  return { pages, warnings };
}

function shortUrl(url: string) {
  try {
    const u = new URL(url);
    return u.host + u.pathname.slice(0, 48);
  } catch {
    return url.slice(0, 64);
  }
}

export async function importPastedText(raw: string): Promise<ImportResult> {
  const trimmed = raw.trim();
  if (!trimmed) return { pages: [], warnings: ["Paste a link, image URLs, or page HTML."] };

  if (looksLikeHtml(trimmed)) {
    const urls = extractImageUrlsFromHtml(trimmed);
    if (!urls.length) {
      return {
        pages: [],
        warnings: ["That HTML had no images. Drop the page files instead."],
      };
    }
    const data = urls.filter((u) => u.startsWith("data:image/"));
    const rest = urls.filter((u) => !u.startsWith("data:"));
    const fromData: MangaPage[] = [];
    for (const [i, d] of data.entries()) {
      const blob = await (await fetch(d)).blob();
      fromData.push(await blobToPage(blob, `pasted-${i + 1}`, "html"));
    }
    const remote = await loadRemoteUrls(rest, "html");
    return { pages: [...fromData, ...remote.pages], warnings: remote.warnings };
  }

  const tokens = splitPastedInput(trimmed);
  const imageUrls = tokens.filter(isDirectImageUrl);
  const pageUrls = tokens.filter((t) => !isDirectImageUrl(t) && /^https?:\/\//i.test(t));

  const warnings: string[] = [];
  const pages: MangaPage[] = [];

  if (imageUrls.length) {
    const loaded = await loadRemoteUrls(imageUrls, "url");
    pages.push(...loaded.pages);
    warnings.push(...loaded.warnings);
  }

  for (const pageUrl of pageUrls) {
    try {
      const res = await fetch(pageUrl, { mode: "cors", credentials: "omit" });
      if (!res.ok) throw new Error(String(res.status));
      const contentType = res.headers.get("content-type") || "";
      if (contentType.startsWith("image/")) {
        const blob = await res.blob();
        pages.push(await blobToPage(blob, pageUrl, "url"));
        continue;
      }
      const html = await res.text();
      const urls = extractImageUrlsFromHtml(html, pageUrl);
      if (!urls.length) {
        warnings.push(`No images found at ${shortUrl(pageUrl)}.`);
        continue;
      }
      const loaded = await loadRemoteUrls(urls, "url");
      pages.push(...loaded.pages);
      warnings.push(...loaded.warnings);
    } catch {
      warnings.push(
        `This address cannot be read from your browser (CORS). Nothing was sent to a server. Drop the downloaded page images, or paste direct image URLs.`,
      );
    }
  }

  if (!pages.length && !warnings.length) {
    warnings.push("Could not find images in that paste.");
  }

  return { pages, warnings };
}

export async function makeSamplePages(): Promise<MangaPage[]> {
  const layouts = [
    [1],
    [2, 1],
    [1, 1, 1],
    [1, 2],
    [3],
    [1, 1],
  ];
  const pages: MangaPage[] = [];
  for (const [i, layout] of layouts.entries()) {
    const blob = await drawSamplePage(i + 1, layout);
    pages.push(await blobToPage(blob, `sample-${String(i + 1).padStart(2, "0")}.png`, "sample"));
  }
  return pages;
}

function drawSamplePage(index: number, rows: number[]): Promise<Blob> {
  const w = 720;
  const h = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#efe6d4";
  ctx.fillRect(0, 0, w, h);

  const margin = 36;
  const gutter = 14;
  const innerH = h - margin * 2 - 48;
  const innerW = w - margin * 2;
  const total = rows.reduce((a, b) => a + b, 0);
  let y = margin + 36;

  ctx.fillStyle = "#1a1714";
  ctx.font = "600 18px Figtree, sans-serif";
  ctx.fillText(`Sample page ${index}`, margin, 42);

  let cell = 0;
  for (const cols of rows) {
    const rowH = (innerH - gutter * (rows.length - 1)) * (cols / total);
    const colW = (innerW - gutter * (cols - 1)) / cols;
    for (let c = 0; c < cols; c++) {
      cell += 1;
      const x = margin + c * (colW + gutter);
      ctx.fillStyle = "#f7f1e4";
      ctx.fillRect(x, y, colW, rowH);
      ctx.strokeStyle = "#1a1714";
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1.5, y + 1.5, colW - 3, rowH - 3);

      ctx.fillStyle = "#c8bfae";
      ctx.beginPath();
      ctx.arc(x + colW * 0.5, y + rowH * 0.42, Math.min(colW, rowH) * 0.12, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#8a8173";
      ctx.font = "italic 14px Instrument Serif, serif";
      ctx.textAlign = "center";
      ctx.fillText("panel", x + colW / 2, y + rowH * 0.62);
      ctx.textAlign = "left";
    }
    y += rowH + gutter;
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/png");
  });
}
