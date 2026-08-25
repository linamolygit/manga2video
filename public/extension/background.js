importScripts("zip.js");

function filenameFromUrl(url, index) {
  const n = String(index + 1).padStart(3, "0");
  try {
    const parsed = new URL(url);
    let base = decodeURIComponent(parsed.pathname.split("/").pop() || "image.jpg");
    base = base.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");
    return `${n}_${base || "image.jpg"}`;
  } catch {
    return `${n}_image.jpg`;
  }
}

async function downloadBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  try {
    await chrome.downloads.download({ url: objectUrl, filename, saveAs: false });
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }
}

async function readImage(url) {
  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) throw new Error(`fetch ${response.status}`);
  return response.blob();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "downloadOne") {
    (async () => {
      const blob = await readImage(message.url);
      const name = filenameFromUrl(message.url, message.index ?? 0).replace(/^\d+_/, "");
      await downloadBlob(blob, name);
      sendResponse({ ok: true, name });
    })().catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));
    return true;
  }

  if (message?.type === "downloadZip") {
    (async () => {
      const urls = Array.isArray(message.urls) ? message.urls : [];
      const files = [];
      const errors = [];
      for (let index = 0; index < urls.length; index += 1) {
        try {
          const blob = await readImage(urls[index]);
          files.push({ name: filenameFromUrl(urls[index], index), data: new Uint8Array(await blob.arrayBuffer()) });
        } catch (error) {
          errors.push({ url: urls[index], error: String(error?.message || error) });
        }
      }
      if (!files.length) {
        sendResponse({ ok: false, error: "No selected images could be downloaded.", errors });
        return;
      }
      const archive = await globalThis.PanelReelZip.build(files);
      await downloadBlob(archive, "panel-reel-images.zip");
      sendResponse({ ok: true, saved: files.length, failed: errors.length, errors });
    })().catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));
    return true;
  }
});