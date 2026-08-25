export type TransitionKind = "none" | "fade" | "slide";

export type ExportOptions = {
  duration: number;
  transition: TransitionKind;
  height: number | "original";
  fps: number;
  onProgress: (ratio: number, label: string) => void;
};

function pickMime() {
  const types = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? "video/webm";
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode an image"));
    img.src = url;
  });
}

function even(n: number) {
  const r = Math.max(2, Math.round(n));
  return r % 2 === 0 ? r : r + 1;
}

function drawContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  dx = 0,
) {
  const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const x = (w - dw) / 2 + dx;
  const y = (h - dh) / 2;
  ctx.drawImage(img, x, y, dw, dh);
}

export async function exportSlideshow(
  urls: string[],
  options: ExportOptions,
): Promise<Blob> {
  if (!urls.length) throw new Error("No pages to export");
  if (typeof MediaRecorder === "undefined") {
    throw new Error("This browser cannot record video");
  }

  options.onProgress(0.02, "Loading pages");
  const images = await Promise.all(urls.map(loadImage));

  let outW: number;
  let outH: number;
  if (options.height === "original") {
    outW = Math.max(...images.map((i) => i.naturalWidth));
    outH = Math.max(...images.map((i) => i.naturalHeight));
    const maxDim = 1920;
    if (outW > maxDim || outH > maxDim) {
      const s = maxDim / Math.max(outW, outH);
      outW = even(outW * s);
      outH = even(outH * s);
    } else {
      outW = even(outW);
      outH = even(outH);
    }
  } else {
    const avg = images.reduce((s, i) => s + i.naturalWidth / i.naturalHeight, 0) / images.length;
    outH = even(options.height);
    outW = even(outH * avg);
  }

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d")!;

  const stream = canvas.captureStream(options.fps);
  const mimeType = pickMime();
  const chunks: BlobPart[] = [];

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 5_000_000,
  });

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onerror = () => reject(new Error("Recording failed"));
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  recorder.start();

  const pageDur = options.duration;
  const transDur = options.transition === "none" ? 0 : Math.min(0.4, pageDur * 0.25);
  const holdDur = pageDur - transDur;
  const total = images.length * pageDur;

  const start = performance.now();

  await new Promise<void>((resolve) => {
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      if (t >= total) {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, outW, outH);
        drawContain(ctx, images[images.length - 1], outW, outH);
        options.onProgress(1, "Finishing");
        resolve();
        return;
      }

      const pageIndex = Math.min(images.length - 1, Math.floor(t / pageDur));
      const local = t - pageIndex * pageDur;
      const current = images[pageIndex];
      const prev = pageIndex > 0 ? images[pageIndex - 1] : null;

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, outW, outH);

      if (options.transition !== "none" && prev && local < transDur) {
        const p = local / transDur;
        if (options.transition === "fade") {
          ctx.globalAlpha = 1 - p;
          drawContain(ctx, prev, outW, outH);
          ctx.globalAlpha = p;
          drawContain(ctx, current, outW, outH);
          ctx.globalAlpha = 1;
        } else {
          drawContain(ctx, prev, outW, outH, -p * outW);
          drawContain(ctx, current, outW, outH, (1 - p) * outW);
        }
      } else {
        drawContain(ctx, current, outW, outH);
      }

      options.onProgress(
        Math.min(0.99, t / total),
        `Page ${pageIndex + 1} of ${images.length}`,
      );
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  recorder.stop();
  void holdDur;
  return done;
}
