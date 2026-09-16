import type { Groove } from "./groove";
import { normalizeGroove, snapshotGroove } from "./groove";
import { clonePatch } from "./patches";
import type { LayerMix, Patch, StackMode } from "./types";

export const SCENE_N = 8;

export type Scene = {
  layerA: Patch;
  layerB: Patch;
  mixA: LayerMix;
  mixB: LayerMix;
  stackMode: StackMode;
  splitNote: number;
  groove: Groove;
};

export type SceneSlot = Scene | null;

const KEY = "lyra32-scenes";

export function emptyScenes(): SceneSlot[] {
  return Array.from({ length: SCENE_N }, () => null);
}

export function captureScene(s: {
  layerA: Patch;
  layerB: Patch;
  mixA: LayerMix;
  mixB: LayerMix;
  stackMode: StackMode;
  splitNote: number;
  groove: Groove;
}): Scene {
  return {
    layerA: clonePatch(s.layerA),
    layerB: clonePatch(s.layerB),
    mixA: { ...s.mixA },
    mixB: { ...s.mixB },
    stackMode: s.stackMode === "split" ? "split" : "stack",
    splitNote: s.splitNote,
    groove: snapshotGroove(s.groove),
  };
}

export function loadScenes(): SceneSlot[] {
  const out = emptyScenes();
  if (typeof window === "undefined") return out;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return out;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return out;
    for (let i = 0; i < SCENE_N; i++) {
      const x = parsed[i];
      if (!x || typeof x !== "object") continue;
      const s = x as Scene;
      if (!s.layerA || !s.layerB) continue;
      out[i] = {
        layerA: clonePatch(s.layerA),
        layerB: clonePatch(s.layerB),
        mixA: { on: Boolean(s.mixA?.on), level: num(s.mixA?.level, 1), pan: num(s.mixA?.pan, 0) },
        mixB: { on: Boolean(s.mixB?.on), level: num(s.mixB?.level, 0.7), pan: num(s.mixB?.pan, 0.15) },
        stackMode: s.stackMode === "split" ? "split" : "stack",
        splitNote: num(s.splitNote, 60),
        groove: normalizeGroove(s.groove),
      };
    }
  } catch {
    /* */
  }
  return out;
}

export function saveScenes(slots: SceneSlot[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(slots));
  } catch {
    /* quota */
  }
}

function num(n: unknown, d: number) {
  return typeof n === "number" && Number.isFinite(n) ? n : d;
}
