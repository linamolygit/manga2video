import { create } from "zustand";
import type { MangaPage } from "./pages";
import type { TransitionKind } from "./video-export";

type Settings = {
  duration: number;
  transition: TransitionKind;
  height: number | "original";
  fps: number;
};

type AppState = {
  pages: MangaPage[];
  warnings: string[];
  settings: Settings;
  exporting: boolean;
  progress: number;
  progressLabel: string;
  resultUrl: string | null;
  addPages: (pages: MangaPage[]) => void;
  setWarnings: (w: string[]) => void;
  removePage: (id: string) => void;
  movePage: (fromId: string, toId: string) => void;
  clearPages: () => void;
  setSettings: (partial: Partial<Settings>) => void;
  setExporting: (v: boolean) => void;
  setProgress: (ratio: number, label: string) => void;
  setResultUrl: (url: string | null) => void;
};

export const useAppStore = create<AppState>((set, get) => ({
  pages: [],
  warnings: [],
  settings: {
    duration: 1,
    transition: "fade",
    height: 720,
    fps: 24,
  },
  exporting: false,
  progress: 0,
  progressLabel: "",
  resultUrl: null,
  addPages: (incoming) =>
    set((s) => ({ pages: [...s.pages, ...incoming] })),
  setWarnings: (warnings) => set({ warnings }),
  removePage: (id) => {
    const page = get().pages.find((p) => p.id === id);
    if (page) URL.revokeObjectURL(page.url);
    set((s) => ({ pages: s.pages.filter((p) => p.id !== id) }));
  },
  movePage: (fromId, toId) => {
    const pages = [...get().pages];
    const from = pages.findIndex((p) => p.id === fromId);
    const to = pages.findIndex((p) => p.id === toId);
    if (from < 0 || to < 0 || from === to) return;
    const [item] = pages.splice(from, 1);
    pages.splice(to, 0, item);
    set({ pages });
  },
  clearPages: () => {
    for (const p of get().pages) URL.revokeObjectURL(p.url);
    const prev = get().resultUrl;
    if (prev) URL.revokeObjectURL(prev);
    set({ pages: [], warnings: [], resultUrl: null, progress: 0, progressLabel: "" });
  },
  setSettings: (partial) => set((s) => ({ settings: { ...s.settings, ...partial } })),
  setExporting: (exporting) => set({ exporting }),
  setProgress: (progress, progressLabel) => set({ progress, progressLabel }),
  setResultUrl: (resultUrl) => {
    const prev = get().resultUrl;
    if (prev && prev !== resultUrl) URL.revokeObjectURL(prev);
    set({ resultUrl });
  },
}));
