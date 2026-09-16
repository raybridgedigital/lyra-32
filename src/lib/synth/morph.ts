import { clonePatch } from "./patches";
import type { LayerMix, Patch } from "./types";
import type { Scene } from "./scenes";

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function mix(a: LayerMix, b: LayerMix, t: number): LayerMix {
  return {
    on: t < 0.5 ? a.on : b.on,
    level: lerp(a.level, b.level, t),
    pan: lerp(a.pan, b.pan, t),
  };
}

export function morphPatch(a: Patch, b: Patch, t: number): Patch {
  const x = Math.max(0, Math.min(1, t));
  if (x <= 0.001) return clonePatch(a);
  if (x >= 0.999) return clonePatch(b);
  const pick = x < 0.5 ? a : b;
  return clonePatch(a, {
    osc1: {
      ...pick.osc1,
      level: lerp(a.osc1.level, b.osc1.level, x),
      pwm: lerp(a.osc1.pwm, b.osc1.pwm, x),
      fine: lerp(a.osc1.fine, b.osc1.fine, x),
      wtWarp: lerp(a.osc1.wtWarp ?? 0, b.osc1.wtWarp ?? 0, x),
    },
    osc2: {
      ...pick.osc2,
      level: lerp(a.osc2.level, b.osc2.level, x),
      pwm: lerp(a.osc2.pwm, b.osc2.pwm, x),
      fine: lerp(a.osc2.fine, b.osc2.fine, x),
    },
    subLevel: lerp(a.subLevel, b.subLevel, x),
    noiseLevel: lerp(a.noiseLevel, b.noiseLevel, x),
    fmIndex: lerp(a.fmIndex, b.fmIndex, x),
    drive: lerp(a.drive, b.drive, x),
    ring: lerp(a.ring, b.ring, x),
    master: lerp(a.master, b.master, x),
    filter: {
      ...pick.filter,
      cutoff: lerp(a.filter.cutoff, b.filter.cutoff, x),
      resonance: lerp(a.filter.resonance, b.filter.resonance, x),
      envAmount: lerp(a.filter.envAmount, b.filter.envAmount, x),
      tone: lerp(a.filter.tone ?? 0.5, b.filter.tone ?? 0.5, x),
    },
    ampEnv: {
      attack: lerp(a.ampEnv.attack, b.ampEnv.attack, x),
      decay: lerp(a.ampEnv.decay, b.ampEnv.decay, x),
      sustain: lerp(a.ampEnv.sustain, b.ampEnv.sustain, x),
      release: lerp(a.ampEnv.release, b.ampEnv.release, x),
    },
    fx: {
      delayMix: lerp(a.fx.delayMix, b.fx.delayMix, x),
      delayTime: lerp(a.fx.delayTime, b.fx.delayTime, x),
      delayFeedback: lerp(a.fx.delayFeedback, b.fx.delayFeedback, x),
      reverbMix: lerp(a.fx.reverbMix, b.fx.reverbMix, x),
      chorusMix: lerp(a.fx.chorusMix, b.fx.chorusMix, x),
      phaserMix: lerp(a.fx.phaserMix ?? 0, b.fx.phaserMix ?? 0, x),
    },
    lfo: { ...pick.lfo, depth: lerp(a.lfo.depth, b.lfo.depth, x), rate: lerp(a.lfo.rate, b.lfo.rate, x) },
  });
}

export function morphScene(a: Scene, b: Scene, t: number) {
  const x = Math.max(0, Math.min(1, t));
  return {
    layerA: morphPatch(a.layerA, b.layerA, x),
    layerB: morphPatch(a.layerB, b.layerB, x),
    mixA: mix(a.mixA, b.mixA, x),
    mixB: mix(a.mixB, b.mixB, x),
    stackMode: x < 0.5 ? a.stackMode : b.stackMode,
    splitNote: Math.round(lerp(a.splitNote, b.splitNote, x)),
    groove: x < 0.5 ? a.groove : b.groove,
    name: x < 0.5 ? a.name : b.name,
  };
}
