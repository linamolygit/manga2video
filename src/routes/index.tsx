import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  BookOpen,
  Clapperboard,
  Download,
  FolderOpen,
  Link2,
  LoaderCircle,
  Play,
  Shield,
  Trash2,
  X,
  Puzzle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { importFiles, importPastedText, makeSamplePages } from "@/lib/import-local";
import { exportSlideshow, type TransitionKind } from "@/lib/video-export";
import { useAppStore } from "@/lib/store";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const pages = useAppStore((s) => s.pages);
  const warnings = useAppStore((s) => s.warnings);
  const settings = useAppStore((s) => s.settings);
  const exporting = useAppStore((s) => s.exporting);
  const progress = useAppStore((s) => s.progress);
  const progressLabel = useAppStore((s) => s.progressLabel);
  const resultUrl = useAppStore((s) => s.resultUrl);
  const addPages = useAppStore((s) => s.addPages);
  const setWarnings = useAppStore((s) => s.setWarnings);
  const clearPages = useAppStore((s) => s.clearPages);
  const setSettings = useAppStore((s) => s.setSettings);
  const setExporting = useAppStore((s) => s.setExporting);
  const setProgress = useAppStore((s) => s.setProgress);
  const setResultUrl = useAppStore((s) => s.setResultUrl);

  const [paste, setPaste] = useState("");
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    async (list: FileList | File[]) => {
      setImporting(true);
      try {
        const result = await importFiles(list);
        addPages(result.pages);
        setWarnings(result.warnings);
      } finally {
        setImporting(false);
      }
    },
    [addPages, setWarnings],
  );

  const handlePasteImport = useCallback(async () => {
    setImporting(true);
    try {
      const result = await importPastedText(paste);
      addPages(result.pages);
      setWarnings(result.warnings);
      if (result.pages.length) setPaste("");
    } finally {
      setImporting(false);
    }
  }, [addPages, paste, setWarnings]);

  const handleGenerate = useCallback(async () => {
    if (!pages.length || exporting) return;
    setExporting(true);
    setProgress(0, "Starting");
    try {
      const blob = await exportSlideshow(
        pages.map((p) => p.url),
        {
          ...settings,
          onProgress: setProgress,
        },
      );
      setResultUrl(URL.createObjectURL(blob));
    } catch (err) {
      setWarnings([err instanceof Error ? err.message : "Export failed"]);
    } finally {
      setExporting(false);
    }
  }, [exporting, pages, setExporting, setProgress, setResultUrl, setWarnings, settings]);

  const loadSamples = useCallback(async () => {
    setImporting(true);
    try {
      const samples = await makeSamplePages();
      addPages(samples);
      setWarnings([]);
    } finally {
      setImporting(false);
    }
  }, [addPages, setWarnings]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) {
        if (target.tagName === "TEXTAREA" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          void handlePasteImport();
        }
        return;
      }
      if (!pages.length || exporting) return;
      e.preventDefault();
      void handleGenerate();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exporting, handleGenerate, handlePasteImport, pages.length]);

  return (
    <main className="min-h-screen bg-bg text-fg">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-md bg-surface-2 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
              <Clapperboard className="size-4 text-paper" />
            </span>
            <div>
              <p className="font-display text-xl leading-tight text-fg">Panel Reel</p>
              <p className="text-xs text-muted">Pages to motion, in your browser</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/extension"
              className="inline-flex h-11 items-center gap-2 rounded-md px-3 text-sm text-muted hover:text-fg"
            >
              <Puzzle className="size-4" />
              <span className="hidden sm:inline">Saver extension</span>
            </Link>
            <div className="hidden items-center gap-2 text-xs text-muted md:flex">
              <Shield className="size-3.5" />
              Stays on this device
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <section className="mb-8 max-w-2xl">
          <h1 className="font-display text-4xl leading-tight tracking-tight text-fg sm:text-5xl">
            Your pages. A slideshow video.
          </h1>
          <p className="mt-3 text-muted">
            Drop files you already have, or paste a reader link. Import and export run only in
            this browser — no upload, no proxy, no server copy. Need every image on a page you
            already opened? Use the{" "}
            <Link to="/extension" className="text-paper underline-offset-2 hover:underline">
              Saver extension
            </Link>
            .
          </p>
        </section>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <label
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files);
            }}
            className={cn(
              "flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-xl bg-surface p-6 text-center shadow-[0_0_0_1px_rgba(255,255,255,0.08)] transition-[box-shadow,background-color] duration-150",
              dragOver && "bg-surface-2 shadow-[0_0_0_1px_rgba(232,226,214,0.45)]",
            )}
          >
            <input
              type="file"
              accept="image/*,.zip,.html,.htm"
              multiple
              className="sr-only"
              onChange={(e) => {
                if (e.target.files?.length) void handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <FolderOpen className="mb-3 size-7 text-paper" />
            <p className="text-sm font-medium">Drop pages or a ZIP</p>
            <p className="mt-1 max-w-sm text-xs text-muted">
              Images, a ZIP of images, or a saved HTML page. Tall ZIP strips are automatically cut
              into numbered pages in your browser; drag cards later to reorder.
            </p>
            <span className="mt-4 inline-flex h-11 items-center rounded-md bg-surface-2 px-4 text-sm shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
              Choose files
            </span>
          </label>

          <div className="rounded-xl bg-surface p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Link2 className="size-4 text-paper" />
              Paste a link
            </div>
            <p className="mb-3 text-xs text-muted">
              Works only if the site allows your browser to read it (most paid readers block
              this). Direct image URLs and pasted HTML source are tried locally — never through
              our servers.
            </p>
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              rows={5}
              placeholder="https://…  or several image URLs, one per line"
              className="w-full resize-y rounded-md bg-bg px-3 py-2.5 text-sm text-fg shadow-[0_0_0_1px_rgba(255,255,255,0.08)] outline-none placeholder:text-subtle focus:shadow-[0_0_0_1px_rgba(232,226,214,0.45)]"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => void handlePasteImport()}
                disabled={importing || !paste.trim()}
              >
                {importing ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Link2 className="size-4" />
                )}
                Import in browser
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void loadSamples()}
                disabled={importing}
              >
                <BookOpen className="size-4" />
                Sample pages
              </Button>
            </div>
          </div>
        </div>

        {warnings.length > 0 && (
          <ul className="mt-4 space-y-2 rounded-lg bg-surface px-4 py-3 text-sm text-muted shadow-[0_0_0_1px_rgba(196,92,74,0.35)]">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}

        {pages.length > 0 && (
          <section className="mt-8">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl">Pages</h2>
                <p className="text-xs text-muted tabular-nums">
                  {pages.length} in reel · drag to reorder
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={clearPages}>
                <Trash2 className="size-3.5" />
                Clear
              </Button>
            </div>
            <PageGrid />
          </section>
        )}

        {pages.length > 0 && (
          <section className="mt-8 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
            <h2 className="font-display text-2xl">Export</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Seconds per page">
                <input
                  type="number"
                  min={0.25}
                  max={12}
                  step={0.25}
                  value={settings.duration}
                  onChange={(e) => setSettings({ duration: Number(e.target.value) || 2.5 })}
                  className={fieldClass}
                />
              </Field>
              <Field label="Transition">
                <select
                  value={settings.transition}
                  onChange={(e) =>
                    setSettings({ transition: e.target.value as TransitionKind })
                  }
                  className={fieldClass}
                >
                  <option value="none">Cut</option>
                  <option value="fade">Fade</option>
                  <option value="slide">Slide</option>
                </select>
              </Field>
              <Field label="Height">
                <select
                  value={String(settings.height)}
                  onChange={(e) =>
                    setSettings({
                      height: e.target.value === "original" ? "original" : Number(e.target.value),
                    })
                  }
                  className={fieldClass}
                >
                  <option value="1080">1080p</option>
                  <option value="720">720p</option>
                  <option value="540">540p</option>
                  <option value="original">Original</option>
                </select>
              </Field>
              <Field label="Frame rate">
                <select
                  value={settings.fps}
                  onChange={(e) => setSettings({ fps: Number(e.target.value) })}
                  className={fieldClass}
                >
                  <option value="24">24</option>
                  <option value="30">30</option>
                  <option value="60">60</option>
                </select>
              </Field>
            </div>

            <p className="mt-3 text-xs text-muted">
              Fast export records in real time (about {(pages.length * settings.duration).toFixed(1)}s).
              Press Enter to start.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={() => void handleGenerate()} disabled={exporting}>
                {exporting ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4" />
                )}
                Generate video
              </Button>
            </div>

            {exporting && (
              <div className="mt-4">
                <div className="h-1.5 overflow-hidden rounded-full bg-bg">
                  <div
                    className="h-full bg-paper transition-[width] duration-150"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted tabular-nums">
                  {progressLabel} · {Math.round(progress * 100)}%
                </p>
              </div>
            )}
          </section>
        )}

        {resultUrl && (
          <section className="mt-8 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
            <h2 className="font-display text-2xl">Ready</h2>
            <video
              className="mt-4 max-h-[70vh] w-full rounded-lg bg-bg"
              src={resultUrl}
              controls
              playsInline
            />
            <a href={resultUrl} download="panel-reel.webm" className="mt-4 inline-flex">
              <Button type="button">
                <Download className="size-4" />
                Download WebM
              </Button>
            </a>
          </section>
        )}
      </div>
    </main>
  );
}

const fieldClass =
  "h-11 w-full rounded-md bg-bg px-3 text-sm text-fg shadow-[0_0_0_1px_rgba(255,255,255,0.08)] outline-none focus:shadow-[0_0_0_1px_rgba(232,226,214,0.45)]";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function PageGrid() {
  const pages = useAppStore((s) => s.pages);
  const removePage = useAppStore((s) => s.removePage);
  const movePage = useAppStore((s) => s.movePage);

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {pages.map((page, i) => (
        <li
          key={page.id}
          draggable
          onDragStart={(e) => e.dataTransfer.setData("text/plain", page.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const from = e.dataTransfer.getData("text/plain");
            movePage(from, page.id);
          }}
          className="group relative overflow-hidden rounded-lg bg-surface-2 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
        >
          <span className="absolute left-2 top-2 z-10 flex size-6 items-center justify-center rounded-full bg-paper text-xs font-medium tabular-nums text-paper-fg">
            {i + 1}
          </span>
          <button
            type="button"
            onClick={() => removePage(page.id)}
            className="absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-full bg-bg/80 text-fg opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            aria-label={`Remove ${page.name}`}
          >
            <X className="size-3.5" />
          </button>
          <img src={page.url} alt={page.name} className="aspect-[3/4] w-full object-cover" />
          <p className="truncate px-2 py-1.5 text-[11px] text-muted">{page.name}</p>
        </li>
      ))}
    </ul>
  );
}
