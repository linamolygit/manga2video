const statusEl = document.getElementById("status");
const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const errorEl = document.getElementById("error");
const countEl = document.getElementById("count");
const zipBtn = document.getElementById("zip");
const rescanBtn = document.getElementById("rescan");

let tabId = null;
let items = [];

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.toggle("hidden", !msg);
}

function nameFromUrl(url) {
  if (url.startsWith("data:")) return "embedded-image";
  try {
    const u = new URL(url);
    const base = decodeURIComponent(u.pathname.split("/").pop() || u.hostname);
    return base || url;
  } catch {
    return url;
  }
}

function visibleItems() {
  return items;
}

function render() {
  const vis = visibleItems();
  listEl.innerHTML = "";
  emptyEl.classList.toggle("hidden", vis.length > 0);
  zipBtn.disabled = vis.length === 0;
  countEl.textContent = vis.length ? `${vis.length} images` : "";

  vis.forEach((it, i) => {
    const li = document.createElement("li");
    li.className = "item";
    const img = document.createElement("img");
    img.src = it.url;
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    const meta = document.createElement("div");
    meta.className = "meta";
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = nameFromUrl(it.url);
    name.title = it.url;
    const size = document.createElement("span");
    size.className = "size";
    size.textContent = it.width && it.height ? `${it.width}×${it.height}` : "size unknown";
    meta.append(name, size);
    const actions = document.createElement("div");
    actions.className = "row-actions";
    const saveBtn = document.createElement("button");
    saveBtn.className = "row";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", () => saveOne(it.url, i));
    const removeBtn = document.createElement("button");
    removeBtn.className = "remove";
    removeBtn.type = "button";
    removeBtn.textContent = "×";
    removeBtn.setAttribute("aria-label", `Remove ${nameFromUrl(it.url)}`);
    removeBtn.title = "Remove image";
    removeBtn.addEventListener("click", () => {
      items = items.filter((candidate) => candidate.url !== it.url);
      render();
    });
    actions.append(saveBtn, removeBtn);
    li.append(img, meta, actions);
    listEl.append(li);
  });
}

async function inject() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab");
  if (!tab.url || tab.url.startsWith("chrome") || tab.url.startsWith("edge") || tab.url.startsWith("about:")) {
    throw new Error("Open a normal web page, then click the extension.");
  }
  tabId = tab.id;
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["zip.js", "content.js"],
  });
  return tab;
}

async function scan() {
  showError("");
  statusEl.textContent = "Scanning this page…";
  zipBtn.disabled = true;
  try {
    const tab = await inject();
    const res = await chrome.tabs.sendMessage(tabId, { type: "scan" });
    items = res.items || [];
    statusEl.textContent = tab.title || "This page";
    render();
  } catch (err) {
    items = [];
    render();
    statusEl.textContent = "Could not scan";
    showError(err.message || String(err));
  }
}

async function saveOne(url, index) {
  showError("");
  try {
    await inject();
    const res = await chrome.tabs.sendMessage(tabId, { type: "saveOne", url, index });
    if (!res?.ok) throw new Error(res?.error || "Save failed");
    statusEl.textContent = `Saved ${res.name}`;
  } catch (err) {
    showError(err.message || String(err));
  }
}

async function saveZip() {
  showError("");
  zipBtn.disabled = true;
  statusEl.textContent = "Building zip…";
  try {
    await inject();
    const urls = visibleItems().map((it) => it.url);
    const res = await chrome.tabs.sendMessage(tabId, { type: "saveZip", urls });
    if (!res?.ok) throw new Error(res?.error || "Zip failed");
    statusEl.textContent = `Saved ${res.saved} files` + (res.failed ? ` · ${res.failed} blocked` : "");
  } catch (err) {
    showError(err.message || String(err));
  } finally {
    zipBtn.disabled = visibleItems().length === 0;
  }
}

rescanBtn.addEventListener("click", () => void scan());
zipBtn.addEventListener("click", () => void saveZip());
void scan();
