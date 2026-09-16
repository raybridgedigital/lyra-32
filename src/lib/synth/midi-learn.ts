import { clonePatch } from "./patches";
import { defaultDrawShape } from "./draw-shape";
import type { Patch } from "./types";

export type LearnParam = {
  id: string;
  min: number;
  max: number;
  set: (p: Patch, v: number) => Patch;
};

function lerp(min: number, max: number, t: number) {
  return min + (max - min) * t;
}

function kn(id: string, min: number, max: number, set: LearnParam["set"]): LearnParam {
  return { id, min, max, set };
}

export const LEARN_PARAMS: LearnParam[] = [
  kn("osc1.level", 0, 1, (p, v) => clonePatch(p, { osc1: { ...p.osc1, level: v } })),
  kn("osc1.pwm", 0, 1, (p, v) => clonePatch(p, { osc1: { ...p.osc1, pwm: v } })),
  kn("osc2.level", 0, 1, (p, v) => clonePatch(p, { osc2: { ...p.osc2, level: v } })),
  kn("osc2.pwm", 0, 1, (p, v) => clonePatch(p, { osc2: { ...p.osc2, pwm: v } })),
  kn("sub", 0, 1, (p, v) => clonePatch(p, { subLevel: v })),
  kn("noise", 0, 1, (p, v) => clonePatch(p, { noiseLevel: v })),
  kn("drive", 0, 1, (p, v) => clonePatch(p, { drive: v })),
  kn("fm", 0, 1, (p, v) => clonePatch(p, { fmIndex: v })),
  kn("ring", 0, 1, (p, v) => clonePatch(p, { ring: v })),
  kn("cut", 0, 1, (p, v) => clonePatch(p, { filter: { ...p.filter, cutoff: v } })),
  kn("res", 0, 1, (p, v) => clonePatch(p, { filter: { ...p.filter, resonance: v } })),
  kn("fenv", 0, 1, (p, v) => clonePatch(p, { filter: { ...p.filter, envAmount: v } })),
  kn("tone", 0, 1, (p, v) => clonePatch(p, { filter: { ...p.filter, tone: v } })),
  kn("atk", 0.001, 4, (p, v) => clonePatch(p, { ampEnv: { ...p.ampEnv, attack: v } })),
  kn("dec", 0.01, 4, (p, v) => clonePatch(p, { ampEnv: { ...p.ampEnv, decay: v } })),
  kn("sus", 0, 1, (p, v) => clonePatch(p, { ampEnv: { ...p.ampEnv, sustain: v } })),
  kn("rel", 0.02, 6, (p, v) => clonePatch(p, { ampEnv: { ...p.ampEnv, release: v } })),
  kn("lfo.rate", 0.05, 20, (p, v) => clonePatch(p, { lfo: { ...p.lfo, rate: v } })),
  kn("lfo.depth", 0, 1, (p, v) => clonePatch(p, { lfo: { ...p.lfo, depth: v } })),
  kn("dly", 0, 1, (p, v) => clonePatch(p, { fx: { ...p.fx, delayMix: v } })),
  kn("rev", 0, 1, (p, v) => clonePatch(p, { fx: { ...p.fx, reverbMix: v } })),
  kn("cho", 0, 1, (p, v) => clonePatch(p, { fx: { ...p.fx, chorusMix: v } })),
  kn("phs", 0, 1, (p, v) => clonePatch(p, { fx: { ...p.fx, phaserMix: v } })),
  kn("master", 0, 1, (p, v) => clonePatch(p, { master: v })),
  kn("shape.time", 0.2, 8, (p, v) => clonePatch(p, { drawShape: { ...(p.drawShape ?? defaultDrawShape()), time: v } })),
  kn("shape.from", 0, 1, (p, v) => clonePatch(p, { drawShape: { ...(p.drawShape ?? defaultDrawShape()), from: v } })),
  kn("shape.depth", 0, 1, (p, v) => clonePatch(p, { drawShape: { ...(p.drawShape ?? defaultDrawShape()), depth: v } })),
];

const byId = new Map(LEARN_PARAMS.map((p) => [p.id, p]));

export function applyLearnCc(patch: Patch, id: string, unit: number) {
  const spec = byId.get(id);
  if (!spec) return patch;
  const t = Math.max(0, Math.min(1, unit));
  return spec.set(patch, lerp(spec.min, spec.max, t));
}

const MAP_KEY = "lyra32-midi-map";

export function loadMidiMap(): Record<number, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(MAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    const out: Record<number, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const n = Number(k);
      if (Number.isInteger(n) && n >= 0 && n <= 127 && byId.has(v)) out[n] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveMidiMap(map: Record<number, string>) {
  try {
    localStorage.setItem(MAP_KEY, JSON.stringify(map));
  } catch {
    /* */
  }
}
