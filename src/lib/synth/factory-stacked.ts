import { clonePatch, foldMaster } from "./patch-kit";
import type { Patch, StackMode } from "./types";

/** 80 factory pairs from the whole library. Load from A = both; from B = B half. */
export function buildStackedFactory(singles: Patch[]): Patch[] {
  const map = new Map(singles.map((p) => [p.id, p]));
  const get = (id: string) => {
    const p = map.get(id);
    if (!p) throw new Error(`stacked factory missing ${id}`);
    return p;
  };
  const pair = (
    id: string,
    aId: string,
    bId: string,
    opt: { mode?: StackMode; a?: number; b?: number; panB?: number; split?: number } = {},
  ): Patch => {
    const a = get(aId);
    const b = get(bId);
    return foldMaster(
      clonePatch(a, {
        id,
        name: `${a.name} + ${b.name}`,
        category: "Stacked",
        stack: {
          mode: opt.mode ?? "stack",
          splitNote: opt.split ?? 60,
          a: { on: true, level: opt.a ?? 0.92, pan: -0.05 },
          b: {
            on: true,
            level: opt.b ?? 0.7,
            pan: opt.panB ?? 0.14,
            patch: clonePatch(b, { stack: undefined }),
          },
        },
      }),
    );
  };

  return [
    pair("st-warm-sub", "warm-pad", "sub-bass", { b: 0.78 }),
    pair("st-keys-acid", "poly-keys", "acid", { b: 0.62 }),
    pair("st-strings-techno", "strings", "s-techno", { b: 0.58 }),
    pair("st-init-808", "init", "b-808", { b: 0.85 }),
    pair("st-air-copper", "air", "lead", { a: 0.85, b: 0.55, panB: 0.2 }),
    pair("st-bells-rubber", "bells", "b-rubber", { b: 0.72 }),
    pair("st-choir-sub", "p-choir", "sub-bass", { a: 0.88, b: 0.8 }),
    pair("st-ep-disco", "k-ep", "b-disco", { b: 0.7 }),
    pair("st-shimmer-arp", "p-shimmer", "arp-seq", { b: 0.5 }),
    pair("st-close-cow", "y22-close-eyes", "y22-cowbell", { b: 0.45, panB: 0.22 }),
    pair("st-howl-reese", "l-howl", "b-reese", { a: 0.7, b: 0.75 }),
    pair("st-silk-berlin", "p-silk", "t-berlin-sub", { b: 0.82 }),
    pair("st-super-acidseq", "k-super-poly", "s-acid", { b: 0.55 }),
    pair("st-vowel-moog", "pd-vowel", "b-moog", { b: 0.7 }),
    pair("st-cs80-tri", "l-cs80", "b-triangle", { a: 0.78, b: 0.72 }),
    pair("st-juno-house", "s-juno", "b-house", { b: 0.68 }),
    pair("st-after-roll", "t-afterhour", "t-rolling", { a: 0.8, b: 0.65 }),
    pair("st-frozen-porta", "p-frozen", "l-porta", { a: 0.82, b: 0.5, panB: 0.18 }),
    pair("st-trem-funk", "k-trem-ep", "b-funk", { b: 0.62 }),
    pair("st-crystal-pick", "pl-crystal", "b-pick", { b: 0.7 }),
    pair("st-silk-iron", "v57-silk-wake", "v57-iron-sub", { a: 0.9, b: 0.82 }),
    pair("st-glow-porta", "v57-glow-room", "v57-porta-rubber", { b: 0.75 }),
    pair("st-choir-fifth", "v57-bloom-choir", "v57-fifth-bass", { b: 0.68 }),
    pair("st-night-acid", "v57-night-silk", "v57-acid-dry", { a: 0.85, b: 0.6 }),
    pair("st-dry-gate", "v57-dry-poly", "v57-gate-arp", { a: 0.88, b: 0.52 }),
    pair("st-bow-808", "v57-bow-silk", "v57-808-tail", { b: 0.8 }),
    pair("st-ep-click", "v57-dual-ep", "v57-click-sub", { b: 0.78 }),
    pair("st-vowel-pwm", "v57-vowel-bloom", "v57-pwm-sub", { b: 0.7 }),
    pair("st-split-sub-keys", "v57-iron-sub", "v57-dry-poly", { mode: "split", split: 60, a: 1, b: 0.85, panB: 0.08 }),
    pair("st-split-pad-lead", "v57-air-silk", "v57-delay-knife", { mode: "split", split: 62, a: 0.9, b: 0.58, panB: 0.16 }),

    pair("st-dark-dnb", "p-dark", "b-dnb", { a: 0.86, b: 0.72 }),
    pair("st-wide-neuro", "p-wide", "b-neuro", { b: 0.65 }),
    pair("st-wurli-electro", "k-wurli", "b-electro", { b: 0.7 }),
    pair("st-organ-dub", "k-organ", "b-dub", { a: 0.88, b: 0.78 }),
    pair("st-brass-ladder", "br-synth", "b-moog", { b: 0.68 }),
    pair("st-trance-wh", "l-trance", "t-warehouse", { a: 0.72, b: 0.7 }),
    pair("st-night-berg", "p-night", "t-berghain", { a: 0.84, b: 0.62 }),
    pair("st-slow-dark", "s-slow", "b-dark", { b: 0.76 }),
    pair("st-ice-808", "be-ice", "b-808", { a: 0.8, b: 0.82 }),
    pair("st-echo-off", "pl-echo", "s-offbeat", { b: 0.55, panB: 0.2 }),
    pair("st-bright-wob", "k-bright", "b-wobble", { b: 0.62 }),
    pair("st-super-hoover", "supersaw", "t-hoover", { a: 0.7, b: 0.58 }),
    pair("st-stab-hard", "stabs", "t-hard-stab", { a: 0.85, b: 0.6 }),
    pair("st-phaser-hypno", "p-phaser-mk2", "t-hypno-pulse", { b: 0.55 }),
    pair("st-table-vel", "k-table-mk2", "b-vel-mk2", { b: 0.72 }),
    pair("st-talk-funk", "l-talkbox", "b-funk", { a: 0.75, b: 0.65 }),
    pair("st-high-dubch", "s-high", "t-dub-chord", { a: 0.82, b: 0.58 }),
    pair("st-halo-roll", "l-halo", "t-rolling", { a: 0.7, b: 0.62 }),
    pair("st-cluster-glitch", "p-cluster", "v57-glitch-gate", { a: 0.8, b: 0.48, panB: 0.22 }),

    pair("st-liquid-slide", "y22-liquid", "y22-slide-808", { b: 0.8 }),
    pair("st-juno22-clash", "y22-juno", "y22-clash-bass", { b: 0.7 }),
    pair("st-shimmer23-ama", "y23-shimmer", "y23-amapiano", { a: 0.85, b: 0.62, panB: 0.16 }),
    pair("st-trance-brat", "y23-trance", "y24-brat-bass", { a: 0.72, b: 0.7 }),
    pair("st-sad-grit", "y23-sad-piano", "y24-grit-bass", { b: 0.68 }),
    pair("st-plugg-gym", "y24-plugg-pad", "y25-gym-edit", { b: 0.74 }),
    pair("st-slowed-rage", "y24-slowed", "y22-rage-growl", { a: 0.86, b: 0.55 }),
    pair("st-hope-growl", "y25-hope", "y25-wt-growl", { a: 0.84, b: 0.58 }),
    pair("st-demure-ukg", "y25-demure", "y24-ukg24", { b: 0.6 }),
    pair("st-angel-plugg", "y25-angel", "y23-pluggnb", { a: 0.8, b: 0.52, panB: 0.18 }),
    pair("st-felt-log", "y24-fred-piano", "y24-log24", { b: 0.62 }),
    pair("st-mel-garage", "y23-mel-house", "y23-garage", { a: 0.82, b: 0.58 }),
    pair("st-after-ukg", "y22-afterlife", "y22-ukg-wob", { b: 0.64 }),
    pair("st-acad-jerk", "y25-academia", "y25-jerk", { a: 0.86, b: 0.5, panB: 0.2 }),
    pair("st-meltech-blip", "y24-mel-techno", "t-minimal-blip", { b: 0.5 }),
    pair("st-spectral-after", "y26-spectral", "y26-afterdark", { b: 0.72 }),
    pair("st-cloud-moog", "y26-cloud-rap", "y26-moog-bass", { b: 0.76 }),
    pair("st-petal-jphonk", "y26-botanica", "y26-jphonk", { a: 0.84, b: 0.55 }),
    pair("st-crystal-rave", "y26-crystal", "y26-rave", { a: 0.8, b: 0.58 }),
    pair("st-dungeon-break", "y26-dungeon", "y26-break", { a: 0.82, b: 0.48 }),

    pair("st-rush-vel", "v57-rush-cloud", "v57-vel-floor", { b: 0.72 }),
    pair("st-hold-pwm", "v57-hold-horizon", "v57-pwm-sub", { b: 0.7 }),
    pair("st-nave-organ", "v57-arc-nave", "v57-table-organ", { a: 0.86, b: 0.55, panB: 0.12 }),
    pair("st-frozen-howl", "v57-frozen-lift", "v57-sync-howl", { a: 0.84, b: 0.5, panB: 0.2 }),
    pair("st-halo-chop", "v57-halo-delay", "v57-chop-seq", { a: 0.78, b: 0.52 }),
    pair("st-phaser-pulse", "v57-phaser-keys", "v57-pulse-seq", { b: 0.55 }),
    pair("st-fifth-808", "v57-house-fifth", "v57-808-tail", { b: 0.82 }),
    pair("st-trem-fifth", "v57-trem-keys", "v57-fifth-bass", { b: 0.68 }),
    pair("st-wind-iron", "v57-wind-silk", "v57-iron-sub", { a: 0.78, b: 0.8 }),
    pair("st-split-choir-lead", "v57-bloom-choir", "v57-talk-formant", { mode: "split", split: 64, a: 0.9, b: 0.55, panB: 0.14 }),
    pair("st-split-juno-acid", "s-juno", "v57-acid-dry", { mode: "split", split: 55, a: 0.88, b: 0.7 }),
  ];
}