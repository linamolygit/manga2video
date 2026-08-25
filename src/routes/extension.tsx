import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ArrowLeft, Download, Puzzle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/extension")({ component: ExtensionPage });

function ExtensionPage() {
  return (
    <main className="min-h-screen bg-bg text-fg">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            to="/"
            className="inline-flex h-11 items-center gap-2 text-sm text-muted hover:text-fg"
          >
            <ArrowLeft className="size-4" />
            Panel Reel
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex size-12 items-center justify-center rounded-lg bg-surface-2 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
          <Puzzle className="size-5 text-paper" />
        </div>
        <h1 className="font-display text-4xl leading-tight tracking-tight">Panel Reel Saver</h1>
        <p className="mt-3 max-w-xl text-muted">
          A small browser extension. It reads the page you already have open, lists every image
          URL, and lets you save one file or a numbered zip. It does not send the page to a
          server.
        </p>

        <a href="/panel-reel-saver.zip" download className="mt-6 inline-flex">
          <Button type="button" size="lg">
            <Download className="size-4" />
            Download extension zip
          </Button>
        </a>

        <ol className="mt-10 space-y-4 text-sm">
          <Step n="1">Unzip the download. You should see a folder with `manifest.json`.</Step>
          <Step n="2">
            In Chrome, Edge, or Brave open the extensions page and turn on Developer mode.
          </Step>
          <Step n="3">Choose Load unpacked and select that folder.</Step>
          <Step n="4">
            Open the page you are reading, click the extension icon, then Save on one image or
            Save numbered zip. Names come from the URL (`001_original-name.jpg`).
          </Step>
          <Step n="5">Drop those files back into Panel Reel to make the slideshow video.</Step>
        </ol>

        <p className="mt-8 text-xs text-muted">
          Sites can still block a save if the image is locked to the page. If zip misses a file,
          use Save on that row, or drop files you already downloaded.
        </p>
      </div>
    </main>
  );
}

function Step({ n, children }: { n: string; children: ReactNode }) {
  return (
    <li className="flex gap-3 rounded-lg bg-surface p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-paper text-xs font-medium tabular-nums text-paper-fg">
        {n}
      </span>
      <p className="pt-0.5 text-pretty">{children}</p>
    </li>
  );
}
