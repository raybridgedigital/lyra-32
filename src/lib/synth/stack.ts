import type { LayerId, LayerMix, Patch, StackMode, Waveform } from "./types";

export const WAVE_SHORT: Record<Waveform, string> = {
  sine: "Sin",
  triangle: "Tri",
  sawtooth: "Saw",
  square: "Sqr",
  pulse: "Pul",
  supersaw: "Stk",
  wt: "Tbl",
};

const NOTE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function midiName(n: number) {
  const midi = Math.max(0, Math.min(127, Math.round(n)));
  return `${NOTE[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

export function waveLine(p: Patch) {
  return `${WAVE_SHORT[p.osc1.wave] ?? p.osc1.wave} + ${WAVE_SHORT[p.osc2.wave] ?? p.osc2.wave}`;
}

export function defaultMix(on = true): LayerMix {
  return { on, level: on ? 1 : 0.7, pan: 0 };
}

export type EngineLayer = {
  id: LayerId;
  on: boolean;
  level: number;
  pan: number;
  patch: Patch;
};

export type EngineStack = {
  mode: StackMode;
  splitNote: number;
  a: EngineLayer;
  b: EngineLayer;
};

export function layersForNote(stack: EngineStack, midi: number): EngineLayer[] {
  const pick = (L: EngineLayer) => (L.on ? [L] : []);
  if (stack.mode === "split") {
    return midi < stack.splitNote ? pick(stack.a) : pick(stack.b);
  }
  return [...pick(stack.a), ...pick(stack.b)];
}
