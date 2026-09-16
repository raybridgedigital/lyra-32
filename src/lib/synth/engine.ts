import type { LfoWave, ModDest, OscParams, Patch, Waveform } from "./types";
import type { ArpStep } from "./arp";
import { midiToFreq } from "./midi";
import { INIT_PATCH, clonePatch } from "./patches";
import { layersForNote, type EngineLayer, type EngineStack } from "./stack";
import { DRUM_PARTS, defaultGroove, stepsOf, type DrumPart } from "./groove";
import { DrumVoice } from "./drums";
import { wtPeriodic, shapeFromOsc, type WtShape } from "./wavetable";
import { sampleShape, shapeDests, type DrawShape } from "./draw-shape";
import { encodeWavStereo, mergeChunks } from "./wav-bounce";

const MAX_VOICES = 32;
const MAX_VOICES_ANDROID = 8;
const SUPERSAW_DETUNE = [-11, -7, -3, 0, 3, 7, 11];

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function cutoffHz(amount: number, keyTrack: number, midi: number): number {
  const base = 20 * Math.pow(1000, clamp(amount, 0, 1));
  const kt = Math.pow(2, ((midi - 60) / 12) * keyTrack);
  return clamp(base * kt, 20, 18000);
}

function makeImpulse(ctx: AudioContext, seconds = 1.2, decay = 2.6): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

function makeNoise(ctx: AudioContext): AudioBuffer {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function tanhCurve(amount: number): Float32Array {
  const n = 1024;
  const c = new Float32Array(n);
  const k = 1 + amount * 8;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(x * k) / Math.tanh(k);
  }
  return c;
}

function pulseWave(ctx: AudioContext, duty: number): PeriodicWave {
  const n = 48;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  const d = clamp(duty, 0.05, 0.95);
  for (let k = 1; k < n; k++) {
    imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * d);
  }
  return ctx.createPeriodicWave(real, imag);
}

function wtWave(ctx: AudioContext, morph: number): PeriodicWave {
  const n = 32;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  const m = clamp(morph, 0, 1);
  for (let k = 1; k < n; k++) {
    const vowel = (k === 1 ? 0.7 : k === 3 ? 0.45 : k === 5 ? 0.22 : 0.08 / k) * (1 - m);
    const metal = (0.55 / k) * Math.sin(k * 0.7) * m;
    imag[k] = vowel + metal;
    real[k] = m * 0.12 * Math.cos(k * 1.3);
  }
  return ctx.createPeriodicWave(real, imag);
}

function syncWave(ctx: AudioContext, ratio: number): PeriodicWave {
  const n = 48;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  const r = clamp(ratio, 1, 12);
  for (let k = 1; k < n; k++) {
    imag[k] = (2 / (k * Math.PI)) * Math.sin((k * Math.PI) / r);
  }
  return ctx.createPeriodicWave(real, imag);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
}

const ARP_DIV: Record<string, number> = {
  "1/4": 1,
  "1/8": 0.5,
  "1/8t": 1 / 3,
  "1/16": 0.25,
  "1/16t": 1 / 6,
  "1/32": 0.125,
};

export function isIosTouch() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isAndroid() {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

/** Must run inside a user-gesture stack. Never await before this. */
export function kickContext(ctx: AudioContext) {
  try {
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    /* */
  }
  if (ctx.state !== "running" && ctx.state !== "closed") {
    void ctx.resume();
  }
}

function makeAudioContext(): AudioContext {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ios = isIosTouch();
  try {
    return new AC(ios ? { latencyHint: 0.005, sampleRate: 44100 } : { latencyHint: "interactive" });
  } catch {
    try {
      return new AC({ latencyHint: "interactive", ...(ios ? { sampleRate: 44100 } : {}) });
    } catch {
      return new AC();
    }
  }
}

type LfoBank = {
  lfo1: OscillatorNode;
  lfo2: OscillatorNode;
  drift: OscillatorNode;
  sh1: ConstantSourceNode;
  sh2: ConstantSourceNode;
};
type DcBank = { mod: ConstantSourceNode; at: ConstantSourceNode };

function oscLfoType(wave: LfoWave): OscillatorType {
  return wave === "samplehold" ? "square" : wave;
}

class Voice {
  midi: number;
  readonly startedAt: number;
  releasing = false;
  private ctx: AudioContext;
  private vca: GainNode;
  private expr: GainNode;
  private filters: BiquadFilterNode[];
  private oscs: OscillatorNode[] = [];
  private osc1s: OscillatorNode[] = [];
  private osc2s: OscillatorNode[] = [];
  private subs: OscillatorNode[] = [];
  private sources: AudioScheduledSourceNode[] = [];
  private mix: GainNode;
  private pan: StereoPannerNode;
  private fmGain: GainNode | null = null;
  private osc1Mix: GainNode | null = null;
  private osc2Mix: GainNode | null = null;
  private driveIn: GainNode | null = null;
  private fxSend: GainNode | null = null;
  private toneLo: BiquadFilterNode | null = null;
  private toneHi: BiquadFilterNode | null = null;
  private glideBias = 0;
  private dead = false;
  private onEnded: () => void;
  private releaseTimer: number | null = null;
  private extras: AudioNode[] = [];
  patchSnap: Patch;
  private bend: number;
  private fenv: ConstantSourceNode | null = null;
  private layerAmp: GainNode;
  private shapeAmp: GainNode;
  private shapePitch: ConstantSourceNode | null = null;
  private shapeCut: ConstantSourceNode | null = null;
  private basePan = 0;
  private lastShapePwm = -1;
  layer: "a" | "b" | "seq";

  constructor(
    ctx: AudioContext,
    dest: AudioNode,
    lfos: LfoBank,
    patch: Patch,
    midi: number,
    velocity: number,
    bend: number,
    dc: DcBank,
    now: number,
    onEnded: () => void,
    layer?: { id: "a" | "b" | "seq"; gain: number; pan: number },
  ) {
    this.ctx = ctx;
    this.midi = midi;
    this.startedAt = now;
    this.onEnded = onEnded;
    this.patchSnap = patch;
    this.bend = bend;
    this.layer = layer?.id ?? "a";

    this.mix = ctx.createGain();
    this.vca = ctx.createGain();
    this.pan = ctx.createStereoPanner();
    this.expr = ctx.createGain();
    this.vca.gain.setValueAtTime(0.0001, now);
    this.expr.gain.setValueAtTime(1, now);
    this.shapeAmp = ctx.createGain();
    const sh0 = patch.drawShape;
    const shB = patch.drawShape2;
    const y0 = sh0?.on ? sampleShape(sh0.points, 0, sh0.from ?? 0) : 1;
    const yB = shB?.on ? sampleShape(shB.points, 0, shB.from ?? 0) : 1;
    const ampOf = (sh: DrawShape | undefined, y: number) =>
      sh?.on && shapeDests(sh).includes("amp") ? Math.max(0.0001, 1 - sh.depth + sh.depth * y) : 1;
    this.shapeAmp.gain.setValueAtTime(ampOf(sh0, y0) * ampOf(shB, yB), now);
    this.basePan = clamp(layer?.pan ?? 0, -1, 1);

    const shaper = ctx.createWaveShaper();
    shaper.curve = tanhCurve(patch.drive) as Float32Array<ArrayBuffer>;
    shaper.oversample = "none";
    this.driveIn = ctx.createGain();
    this.driveIn.gain.setValueAtTime(1, now);

    const f1 = ctx.createBiquadFilter();
    f1.type = patch.filter.type;
    f1.Q.setValueAtTime(0.2 + patch.filter.resonance * 18, now);
    const f2 = ctx.createBiquadFilter();
    f2.type = patch.filter.type;
    f2.Q.setValueAtTime(0.2 + patch.filter.resonance * 12, now);
    this.filters = patch.filter.slope === 24 ? [f1, f2] : [f1];

    const vel = 0.25 + velocity * 0.75;
    const velCut = (patch.velFilt ?? 0) * (velocity - 0.5) * 0.5;
    const baseCut = cutoffHz(clamp(patch.filter.cutoff + velCut, 0, 1), patch.filter.keyTrack, midi);
    const envAmt = patch.filter.envAmount;
    const startCut = clamp(baseCut * Math.pow(0.15, envAmt), 30, 18000);
    const peakCut = clamp(baseCut * Math.pow(8, envAmt), 30, 18000);
    const susCut = clamp(baseCut * Math.pow(1 + envAmt * 2, patch.filterEnv.sustain), 30, 18000);
    for (const f of this.filters) {
      f.frequency.setValueAtTime(startCut, now);
      f.frequency.linearRampToValueAtTime(peakCut, now + Math.max(0.004, patch.filterEnv.attack));
      f.frequency.setTargetAtTime(
        susCut,
        now + Math.max(0.004, patch.filterEnv.attack),
        Math.max(0.02, patch.filterEnv.decay / 3),
      );
    }

    const toneAmt = clamp(Number.isFinite(patch.filter.tone) ? (patch.filter.tone as number) : 0.5, 0, 1);
    const toneLo = ctx.createBiquadFilter();
    toneLo.type = "lowshelf";
    toneLo.frequency.setValueAtTime(280, now);
    toneLo.gain.setValueAtTime((0.5 - toneAmt) * 10, now);
    const toneHi = ctx.createBiquadFilter();
    toneHi.type = "highshelf";
    toneHi.frequency.setValueAtTime(2400, now);
    toneHi.gain.setValueAtTime((toneAmt - 0.5) * 12, now);
    this.toneLo = toneLo;
    this.toneHi = toneHi;
    this.extras.push(toneLo, toneHi);

    this.mix.connect(this.driveIn);
    this.driveIn.connect(shaper);
    shaper.connect(this.filters[0]!);
    for (let i = 0; i < this.filters.length - 1; i++) this.filters[i]!.connect(this.filters[i + 1]!);
    this.filters[this.filters.length - 1]!.connect(toneLo);
    toneLo.connect(toneHi);
    toneHi.connect(this.vca);
    this.vca.connect(this.shapeAmp);
    this.shapeAmp.connect(this.pan);
    this.pan.connect(this.expr);
    this.layerAmp = ctx.createGain();
    this.layerAmp.gain.setValueAtTime(clamp(layer?.gain ?? 1, 0, 1.5), now);
    this.pan.pan.setValueAtTime(this.basePan, now);
    this.expr.connect(this.layerAmp);
    this.layerAmp.connect(dest);
    this.fxSend = ctx.createGain();
    this.fxSend.gain.setValueAtTime(0, now);
    this.shapeAmp.connect(this.fxSend);
    this.fxSend.connect(dest);

    const uni = Math.max(1, Math.min(7, patch.unison.voices || 1));
    const keyVal = clamp((midi - 60) / 48, -1, 1);
    const randVal = Math.random() * 2 - 1;
    let pwmBias = 0;
    for (const row of patch.matrix ?? []) {
      if (row.dest !== "pwm" || Math.abs(row.amount) < 0.01) continue;
      if (row.src === "vel") pwmBias += row.amount * (velocity - 0.5);
      else if (row.src === "key") pwmBias += row.amount * keyVal * 0.5;
      else if (row.src === "rand") pwmBias += row.amount * randVal * 0.5;
    }
    for (const row of patch.matrix ?? []) {
      if (row.dest !== "glide" || Math.abs(row.amount) < 0.01) continue;
      if (row.src === "vel") this.glideBias += row.amount * (velocity - 0.5);
      else if (row.src === "key") this.glideBias += row.amount * keyVal * 0.5;
      else if (row.src === "rand") this.glideBias += row.amount * randVal * 0.5;
    }
    this.spawnOsc(patch, "osc1", midi, bend, now, uni, pwmBias);
    this.spawnOsc(patch, "osc2", midi, bend, now, uni, pwmBias * 0.7);

    this.shapePitch = ctx.createConstantSource();
    this.shapePitch.offset.setValueAtTime(0, now);
    this.shapePitch.start(now);
    this.extras.push(this.shapePitch);
    this.sources.push(this.shapePitch);
    for (const o of this.oscs) this.shapePitch.connect(o.detune);
    this.shapeCut = ctx.createConstantSource();
    this.shapeCut.offset.setValueAtTime(0, now);
    this.shapeCut.start(now);
    this.extras.push(this.shapeCut);
    this.sources.push(this.shapeCut);
    for (const f of this.filters) this.shapeCut.connect(f.detune);

    if (patch.subLevel > 0.001) {
      const sub = ctx.createOscillator();
      sub.type = "sine";
      const freq = midiToFreq(midi + patch.osc1.octave * 12 - 12, bend);
      sub.frequency.setValueAtTime(freq, now);
      const g = ctx.createGain();
      g.gain.value = patch.subLevel * 0.5 * vel;
      sub.connect(g);
      g.connect(this.mix);
      sub.start(now);
      this.oscs.push(sub);
      this.subs.push(sub);
      this.sources.push(sub);
    }

    if (patch.noiseLevel > 0.001) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf(ctx);
      src.loop = true;
      const g = ctx.createGain();
      g.gain.value = patch.noiseLevel * 0.35 * vel;
      src.connect(g);
      g.connect(this.mix);
      src.start(now);
      this.sources.push(src);
    }

    const freq0 = midiToFreq(midi, bend);
    if (patch.fmIndex > 0.01 && this.osc2s[0] && this.osc1s[0]) {
      const fm = ctx.createGain();
      fm.gain.value = patch.fmIndex * freq0 * 4;
      this.osc2s[0].connect(fm);
      for (const o of this.osc1s) fm.connect(o.frequency);
      this.fmGain = fm;
      this.extras.push(fm);
    }

    const sync = patch.sync ?? 0;
    if (sync > 0.02 && this.osc2s[0] && this.osc1s[0]) {
      const g = ctx.createGain();
      g.gain.value = sync * freq0 * 8;
      this.osc2s[0].connect(g);
      for (const o of this.osc1s) g.connect(o.frequency);
      this.extras.push(g);
      const ratio = 1 + sync * 7;
      try {
        this.osc1s[0].setPeriodicWave(syncWave(ctx, ratio));
      } catch {
        /* */
      }
    }

    const ring = patch.ring ?? 0;
    if (ring > 0.02 && this.osc1s[0] && this.osc2s[0]) {
      const rg = ctx.createGain();
      rg.gain.value = 0;
      this.osc2s[0].connect(rg.gain);
      this.osc1s[0].connect(rg);
      const wet = ctx.createGain();
      wet.gain.value = ring * 0.55;
      rg.connect(wet);
      wet.connect(this.mix);
      this.extras.push(rg, wet);
    }

    const drift = patch.drift ?? 0;
    if (drift > 0.01) {
      const g = ctx.createGain();
      g.gain.value = drift * 22;
      lfos.drift.connect(g);
      for (const o of this.oscs) g.connect(o.detune);
      this.extras.push(g);
    }

    this.routeLfo(lfos.lfo1, patch.lfo, 1, lfos.sh1);
    this.routeLfo(lfos.lfo2, patch.lfo2, 1, lfos.sh2);

    const velDc = ctx.createConstantSource();
    velDc.offset.value = clamp(velocity, 0, 1);
    velDc.start(now);
    this.extras.push(velDc);
    this.sources.push(velDc);

    const fenv = ctx.createConstantSource();
    const fA = Math.max(0.004, patch.filterEnv.attack);
    const fD = Math.max(0.02, patch.filterEnv.decay / 3);
    fenv.offset.setValueAtTime(0, now);
    fenv.offset.linearRampToValueAtTime(1, now + fA);
    fenv.offset.setTargetAtTime(Math.max(0.0001, patch.filterEnv.sustain), now + fA, fD);
    fenv.start(now);
    this.fenv = fenv;
    this.extras.push(fenv);
    this.sources.push(fenv);

    const keyDc = ctx.createConstantSource();
    keyDc.offset.value = keyVal;
    keyDc.start(now);
    this.extras.push(keyDc);
    this.sources.push(keyDc);
    const randDc = ctx.createConstantSource();
    randDc.offset.value = randVal;
    randDc.start(now);
    this.extras.push(randDc);
    this.sources.push(randDc);

    for (const row of patch.matrix ?? []) {
      if (Math.abs(row.amount) < 0.01) continue;
      if (row.src === "lfo1") this.routeLfo(lfos.lfo1, { ...patch.lfo, dest: row.dest, depth: row.amount }, 1, lfos.sh1);
      else if (row.src === "lfo2") this.routeLfo(lfos.lfo2, { ...patch.lfo2, dest: row.dest, depth: row.amount }, 1, lfos.sh2);
      else if (row.src === "mod") this.routeDc(dc.mod, row.dest, row.amount);
      else if (row.src === "at") this.routeDc(dc.at, row.dest, row.amount);
      else if (row.src === "vel") this.routeDc(velDc, row.dest, row.amount);
      else if (row.src === "fenv") this.routeDc(fenv, row.dest, row.amount);
      else if (row.src === "key") this.routeDc(keyDc, row.dest, row.amount);
      else if (row.src === "rand") this.routeDc(randDc, row.dest, row.amount);
    }

    const velAmp = Number.isFinite(patch.velAmp) ? (patch.velAmp as number) : 0;
    const peak = vel * 0.38 * (1 - velAmp * 0.45 + velAmp * velocity);
    const a = Math.max(0.003, patch.ampEnv.attack);
    const d = Math.max(0.01, patch.ampEnv.decay);
    const s = Math.max(0.0001, patch.ampEnv.sustain * peak);
    this.vca.gain.setValueAtTime(0.0001, now);
    this.vca.gain.linearRampToValueAtTime(peak, now + a);
    this.vca.gain.setTargetAtTime(s, now + a, d / 3);

    if ((sh0?.on && sh0.depth > 0.008) || (shB?.on && shB.depth > 0.008)) {
      this.applyShapes(
        [
          ...(sh0?.on ? [{ sh: sh0, y: y0 }] : []),
          ...(shB?.on ? [{ sh: shB, y: yB }] : []),
        ],
        now,
      );
    }
  }

  private routeLfo(lfo: AudioNode, spec: { dest: ModDest; depth: number; fade?: number; wave?: LfoWave }, scale: number, sh?: ConstantSourceNode) {
    const depth = (spec?.depth ?? 0) * scale;
    if (!spec || Math.abs(depth) < 0.008) return;
    const src = spec.wave === "samplehold" && sh ? sh : lfo;
    const ctx = this.ctx;
    const now = this.startedAt;
    const fade = Math.max(0, spec.fade ?? 0) * 2.4;
    const connectScaled = (param: AudioParam, mag: number) => {
      const g = ctx.createGain();
      const target = depth * mag;
      if (fade > 0.03) {
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(target, now + fade);
      } else {
        g.gain.value = target;
      }
      src.connect(g);
      g.connect(param);
      this.extras.push(g);
    };
    const dest: ModDest = spec.dest ?? "cutoff";
    if (dest === "cutoff") {
      for (const f of this.filters) connectScaled(f.detune, 2400);
    } else if (dest === "pitch") {
      for (const o of this.oscs) connectScaled(o.detune, 40);
    } else if (dest === "pan") {
      connectScaled(this.pan.pan, 0.75);
    } else if (dest === "amp") {
      connectScaled(this.vca.gain, 0.22);
    } else if (dest === "res") {
      for (const f of this.filters) connectScaled(f.Q, 10);
    } else if (dest === "fm" && this.fmGain) {
      connectScaled(this.fmGain.gain, 800);
    } else if (dest === "oscMix") {
      if (this.osc1Mix) connectScaled(this.osc1Mix.gain, -0.45);
      if (this.osc2Mix) connectScaled(this.osc2Mix.gain, 0.45);
    } else if (dest === "drive" && this.driveIn) {
      connectScaled(this.driveIn.gain, 0.85);
    } else if (dest === "fx" && this.fxSend) {
      connectScaled(this.fxSend.gain, 0.4);
    } else if (dest === "pwm") {
      for (const o of this.osc1s) connectScaled(o.detune, 18);
    } else {
      return;
    }
  }

  private routeDc(src: ConstantSourceNode, dest: ModDest, amount: number) {
    if (Math.abs(amount) < 0.01) return;
    const g = this.ctx.createGain();
    if (dest === "cutoff") {
      g.gain.value = amount * 2800;
      src.connect(g);
      for (const f of this.filters) g.connect(f.detune);
    } else if (dest === "pitch") {
      g.gain.value = amount * 400;
      src.connect(g);
      for (const o of this.oscs) g.connect(o.detune);
    } else if (dest === "pan") {
      g.gain.value = amount * 0.85;
      src.connect(g);
      g.connect(this.pan.pan);
    } else if (dest === "amp") {
      g.gain.value = amount * 0.45;
      src.connect(g);
      g.connect(this.expr.gain);
    } else if (dest === "res") {
      g.gain.value = amount * 14;
      src.connect(g);
      for (const f of this.filters) g.connect(f.Q);
    } else if (dest === "fm" && this.fmGain) {
      g.gain.value = amount * 1400;
      src.connect(g);
      g.connect(this.fmGain.gain);
    } else if (dest === "oscMix") {
      g.gain.value = amount * 0.5;
      src.connect(g);
      if (this.osc2Mix) g.connect(this.osc2Mix.gain);
      const g2 = this.ctx.createGain();
      g2.gain.value = amount * -0.5;
      src.connect(g2);
      if (this.osc1Mix) g2.connect(this.osc1Mix.gain);
      this.extras.push(g2);
    } else if (dest === "drive" && this.driveIn) {
      g.gain.value = amount * 1.1;
      src.connect(g);
      g.connect(this.driveIn.gain);
    } else if (dest === "fx" && this.fxSend) {
      g.gain.value = amount * 0.55;
      src.connect(g);
      g.connect(this.fxSend.gain);
    } else if (dest === "pwm") {
      g.gain.value = amount * 22;
      src.connect(g);
      for (const o of this.osc1s) g.connect(o.detune);
    } else if (dest === "glide") {
      return;
    } else {
      return;
    }
    this.extras.push(g);
  }

  private spawnOsc(patch: Patch, which: "osc1" | "osc2", midi: number, bend: number, now: number, uni: number, pwmBias = 0) {
    const p = patch[which];
    if ((p.level ?? 0) < 0.001) return;
    const ctx = this.ctx;
    const octave = p.octave ?? 0;
    const semitone = p.semitone ?? 0;
    const fine = p.fine ?? 0;
    const note = midi + octave * 12 + semitone;
    const freq = midiToFreq(note, bend) * Math.pow(2, fine / 1200);
    if (!Number.isFinite(freq) || !Number.isFinite(now)) return;
    const copies = p.wave === "supersaw" ? 5 : uni;
    const detunes =
      p.wave === "supersaw"
        ? SUPERSAW_DETUNE.slice(0, 5)
        : uni === 1
          ? [0]
          : Array.from({ length: uni }, (_, i) => (i - (uni - 1) / 2) * patch.unison.detune * 18);
    const g = ctx.createGain();
    g.gain.value = (p.level / Math.sqrt(copies)) * 0.9;
    g.connect(this.mix);
    if (which === "osc1") this.osc1Mix = g;
    else this.osc2Mix = g;
    const pwm = clamp(p.pwm + pwmBias, 0.05, 0.95);
    for (let i = 0; i < copies; i++) {
      const o = ctx.createOscillator();
      applyWave(ctx, o, p.wave, pwm, p.table, shapeFromOsc(p));
      o.frequency.setValueAtTime(freq, now);
      o.detune.setValueAtTime(detunes[i] ?? 0, now);
      const pan = ctx.createStereoPanner();
      const spread = copies === 1 ? 0 : ((i / (copies - 1)) * 2 - 1) * patch.unison.spread;
      pan.pan.setValueAtTime(spread, now);
      o.connect(pan);
      pan.connect(g);
      o.start(now);
      this.oscs.push(o);
      this.sources.push(o);
      if (which === "osc1") this.osc1s.push(o);
      else this.osc2s.push(o);
    }
  }

  setWaveShape(which: "osc1" | "osc2", p: OscParams) {
    const list = which === "osc1" ? this.osc1s : this.osc2s;
    for (const o of list) {
      try {
        applyWave(this.ctx, o, p.wave, clamp(p.pwm, 0.05, 0.95), p.table, shapeFromOsc(p));
      } catch {
        /* closed */
      }
    }
  }

  setBend(semis: number, when: number) {
    this.bend = semis;
    const p = this.patchSnap;
    const retune = (o: OscillatorNode, note: number, fine: number) => {
      const f = midiToFreq(note, semis) * Math.pow(2, fine / 1200);
      if (!Number.isFinite(f)) return;
      try {
        o.frequency.setTargetAtTime(f, when, 0.015);
      } catch {
        /* closed */
      }
    };
    for (const o of this.osc1s) retune(o, this.midi + p.osc1.octave * 12 + p.osc1.semitone, p.osc1.fine);
    for (const o of this.osc2s) retune(o, this.midi + p.osc2.octave * 12 + p.osc2.semitone, p.osc2.fine);
    for (const o of this.subs) retune(o, this.midi + p.osc1.octave * 12 - 12, 0);
  }

  setCutoff(hz: number, q: number, when: number) {
    for (const f of this.filters) {
      f.frequency.setTargetAtTime(clamp(hz, 20, 18000), when, 0.02);
      f.Q.setTargetAtTime(q, when, 0.03);
    }
  }

  setTone(tone: number, when: number) {
    if (!this.toneLo || !this.toneHi) return;
    const t = Number.isFinite(tone) ? clamp(tone, 0, 1) : 0.5;
    try {
      this.toneLo.gain.setTargetAtTime((0.5 - t) * 10, when, 0.04);
      this.toneHi.gain.setTargetAtTime((t - 0.5) * 12, when, 0.04);
    } catch {
      /* closed */
    }
  }

  glideTo(midi: number, bend: number, patch: Patch, when: number, portamento: boolean) {
    this.midi = midi;
    this.bend = bend;
    this.patchSnap = patch;
    const glide = Math.max(0, (patch.glide ?? 0) * (1 + this.glideBias));
    const usePorta = portamento && glide > 0.01;
    const dur = usePorta ? Math.max(0.03, glide * 1.15) : 0.006;
    const retune = (o: OscillatorNode, note: number, fine: number) => {
      const f = midiToFreq(note, bend) * Math.pow(2, fine / 1200);
      if (!Number.isFinite(f)) return;
      try {
        o.frequency.cancelAndHoldAtTime(when);
      } catch {
        o.frequency.cancelScheduledValues(when);
        o.frequency.setValueAtTime(o.frequency.value, when);
      }
      if (usePorta) o.frequency.linearRampToValueAtTime(f, when + dur);
      else o.frequency.setValueAtTime(f, when);
    };
    for (const o of this.osc1s) retune(o, midi + patch.osc1.octave * 12 + patch.osc1.semitone, patch.osc1.fine);
    for (const o of this.osc2s) retune(o, midi + patch.osc2.octave * 12 + patch.osc2.semitone, patch.osc2.fine);
    for (const o of this.subs) retune(o, midi + patch.osc1.octave * 12 - 12, 0);
  }

  release(patch: Patch) {
    if (this.releasing || this.dead) return;
    this.releasing = true;
    const now = this.ctx.currentTime;
    const r = Math.max(0.02, patch.ampEnv.release);
    this.vca.gain.cancelScheduledValues(now);
    this.vca.gain.setValueAtTime(Math.max(0.0001, this.vca.gain.value), now);
    this.vca.gain.exponentialRampToValueAtTime(0.0001, now + r);
    for (const f of this.filters) {
      const end = cutoffHz(patch.filter.cutoff * 0.6, patch.filter.keyTrack, this.midi);
      f.frequency.setTargetAtTime(end, now, Math.max(0.03, patch.filterEnv.release / 3));
    }
    if (this.fenv) {
      try {
        this.fenv.offset.cancelScheduledValues(now);
        this.fenv.offset.setValueAtTime(Math.max(0.0001, this.fenv.offset.value), now);
        this.fenv.offset.setTargetAtTime(0.0001, now, Math.max(0.03, patch.filterEnv.release / 3));
      } catch {
        /* */
      }
    }
    const hang = r + 0.05;
    this.releaseTimer = window.setTimeout(() => this.kill(), hang * 1000);
    for (const s of this.sources) {
      try {
        s.stop(now + hang);
      } catch {
        /* already */
      }
    }
  }

  get live() {
    return !this.dead && !this.releasing;
  }

  get alive() {
    return !this.dead;
  }

  setMix(gain: number, pan: number, now: number) {
    this.basePan = clamp(pan, -1, 1);
    this.layerAmp.gain.setTargetAtTime(clamp(gain, 0, 1.5), now, 0.03);
    this.pan.pan.setTargetAtTime(this.basePan, now, 0.03);
  }

  applyShape(sh: DrawShape, y: number, now: number) {
    this.applyShapes([{ sh, y }], now);
  }

  applyShapes(jobs: { sh: DrawShape; y: number }[], now: number) {
    if (this.dead) return;
    let amp = 1;
    let pch = 0;
    let cut = 0;
    let panAdd = 0;
    let pwm: number | null = null;
    let drive: number | null = null;
    let fm: number | null = null;
    for (const { sh, y } of jobs) {
      if (!sh.on || sh.depth < 0.008) continue;
      const depth = clamp(sh.depth, 0, 1);
      for (const dest of shapeDests(sh)) {
        if (dest === "amp") amp *= Math.max(0.0001, 1 - depth + depth * y);
        if (dest === "pitch") pch += (y - 0.5) * 2 * depth * 520;
        if (dest === "cutoff") cut += (y - 0.5) * 2 * depth * 2600;
        if (dest === "pan") panAdd += (y - 0.5) * 2 * depth;
        if (dest === "pwm") pwm = clamp(this.patchSnap.osc1.pwm + (y - 0.5) * depth, 0.05, 0.95);
        if (dest === "drive") drive = 1 + (y - 0.5) * 2 * depth * 0.95;
        if (dest === "fm") fm = y;
      }
    }
    try {
      this.shapeAmp.gain.setTargetAtTime(amp, now, 0.018);
    } catch {
      /* */
    }
    if (this.shapePitch) {
      try {
        this.shapePitch.offset.setTargetAtTime(pch, now, 0.02);
      } catch {
        /* */
      }
    }
    if (this.shapeCut) {
      try {
        this.shapeCut.offset.setTargetAtTime(cut, now, 0.02);
      } catch {
        /* */
      }
    }
    if (Math.abs(panAdd) > 0.001) {
      try {
        this.pan.pan.setTargetAtTime(clamp(this.basePan + panAdd, -1, 1), now, 0.03);
      } catch {
        /* */
      }
    }
    if (pwm != null) {
      const q = Math.round(pwm * 48);
      if (q !== this.lastShapePwm) {
        this.lastShapePwm = q;
        this.setWaveShape("osc1", { ...this.patchSnap.osc1, pwm });
      }
    }
    if (drive != null && this.driveIn) {
      try {
        this.driveIn.gain.setTargetAtTime(drive, now, 0.03);
      } catch {
        /* */
      }
    }
    if (fm != null && this.fmGain) {
      const freq0 = midiToFreq(this.midi, this.bend);
      const depth = jobs.find((j) => shapeDests(j.sh).includes("fm"))?.sh.depth ?? 1;
      try {
        this.fmGain.gain.setTargetAtTime(
          Math.max(0, this.patchSnap.fmIndex * freq0 * 4 * (0.15 + fm * depth * 1.7)),
          now,
          0.03,
        );
      } catch {
        /* */
      }
    }
  }

  kill() {
    if (this.dead) return;
    this.dead = true;
    if (this.releaseTimer != null) window.clearTimeout(this.releaseTimer);
    for (const s of this.sources) {
      try {
        s.disconnect();
      } catch {
        /* */
      }
    }
    for (const n of this.extras) {
      try {
        n.disconnect();
      } catch {
        /* */
      }
    }
    try {
      this.vca.disconnect();
      this.shapeAmp.disconnect();
      this.mix.disconnect();
      this.pan.disconnect();
      this.expr.disconnect();
      this.layerAmp.disconnect();
    } catch {
      /* */
    }
    this.onEnded();
  }
}

const noiseCache = new WeakMap<AudioContext, AudioBuffer>();
function noiseBuf(ctx: AudioContext) {
  let b = noiseCache.get(ctx);
  if (!b) {
    b = makeNoise(ctx);
    noiseCache.set(ctx, b);
  }
  return b;
}

function applyWave(ctx: AudioContext, o: OscillatorNode, wave: Waveform, pwm: number, table?: string, shape?: WtShape) {
  if (wave === "pulse") {
    o.setPeriodicWave(pulseWave(ctx, pwm));
    return;
  }
  if (wave === "wt") {
    o.setPeriodicWave(wtPeriodic(ctx, table, pwm, shape));
    return;
  }
  if (wave === "supersaw") {
    o.type = "sawtooth";
    return;
  }
  o.type = wave;
}

export type EngineListener = {
  onVoices?: (n: number) => void;
  onArpStep?: (step: number, note: number | null) => void;
  onGrooveStep?: (step: number) => void;
  onState?: (state: AudioContextState) => void;
};

export class LyraEngine {
  ctx: AudioContext;
  analyser: AnalyserNode;
  private iosEl: HTMLAudioElement | null = null;
  private iosDest: MediaStreamAudioDestinationNode | null = null;
  private patch: Patch = clonePatch(INIT_PATCH);
  private voices: Voice[] = [];
  private held = new Map<number, Voice[] | "arp">();
  private sustain = false;
  private sustained = new Set<number>();
  private bend = 0;
  private cutoffMod = 0;
  private outputVol = 1;
  private buses: {
    voice: GainNode;
    chorusDelay: DelayNode;
    chorusLfo: OscillatorNode;
    chorusGain: GainNode;
    delay: DelayNode;
    delayFb: GainNode;
    delayWet: GainNode;
    conv: ConvolverNode;
    revWet: GainNode;
    dry: GainNode;
    drum: GainNode;
    master: GainNode;
    limiter: DynamicsCompressorNode;
    phaserGain: GainNode;
    phaserLfo: OscillatorNode;
  };
  private lfos: LfoBank;
  private dc: DcBank;
  private arpHeld: number[] = [];
  private arpPhysical = new Set<number>();
  private arpTimer: number | null = null;
  private arpIndex = 0;
  private arpDir = 1;
  private arpNoteCursor = 0;
  private arpVoice: Voice | null = null;
  private arpVoices: Voice[] = [];
  private monoVoice: Voice | null = null;
  private monoStack: number[] = [];
  private listener: EngineListener;
  private started = false;
  private hostBpm: number | null = null;
  private muted = false;
  private arpBag: number[] = [];
  private arpBagKey = "";
  private grooveTimer: number | null = null;
  private grooveIndex = 0;
  private grooveNow = 0;
  private grooveTickAt = 0;
  private groovePlaying = false;
  clickOn = false;
  bouncing = false;
  private clickGain: GainNode | null = null;
  private recNode: ScriptProcessorNode | null = null;
  private recSilent: GainNode | null = null;
  private recL: Float32Array[] = [];
  private recR: Float32Array[] = [];
  private countTimer: number | null = null;
  private shTimer: number | null = null;
  private shAcc1 = 0;
  private shAcc2 = 0;
  private shLast = 0;
  private shapeClock = 0;
  shapePhase = 0;
  private shapeClock2 = 0;
  shapePhase2 = 0;
  private seqVoices: Voice[] = [];
  private seqByTrack: Voice[][] = [[], [], [], []];
  private clipTimers: number[] = [];
  private bank: Patch[] = [];
  private drums: DrumVoice | null = null;
  private stack: EngineStack = {
    mode: "stack",
    splitNote: 60,
    a: { id: "a", on: true, level: 1, pan: 0, patch: clonePatch(INIT_PATCH) },
    b: { id: "b", on: false, level: 0.7, pan: 0.15, patch: clonePatch(INIT_PATCH) },
  };

  constructor(ctx: AudioContext, listener: EngineListener = {}) {
    this.ctx = ctx;
    this.listener = listener;
    ctx.onstatechange = () => listener.onState?.(ctx.state);

    const voice = ctx.createGain();
    const dry = ctx.createGain();
    const chorusDelay = ctx.createDelay(0.05);
    chorusDelay.delayTime.value = 0.012;
    const chorusLfo = ctx.createOscillator();
    chorusLfo.type = "sine";
    chorusLfo.frequency.value = 0.35;
    const chorusDepth = ctx.createGain();
    chorusDepth.gain.value = 0.004;
    chorusLfo.connect(chorusDepth);
    chorusDepth.connect(chorusDelay.delayTime);
    chorusLfo.start();
    const chorusGain = ctx.createGain();
    chorusGain.gain.value = 0;

    const delay = ctx.createDelay(1.2);
    delay.delayTime.value = 0.28;
    const delayFb = ctx.createGain();
    delayFb.gain.value = 0.28;
    const delayWet = ctx.createGain();
    delayWet.gain.value = 0.12;
    delay.connect(delayFb);
    delayFb.connect(delay);
    delay.connect(delayWet);

    const conv = ctx.createConvolver();
    conv.buffer = makeImpulse(ctx);
    const revWet = ctx.createGain();
    revWet.gain.value = 0.18;
    conv.connect(revWet);

    const phaserIn = ctx.createGain();
    let phNode: AudioNode = phaserIn;
    const phasers: BiquadFilterNode[] = [];
    for (let i = 0; i < 4; i++) {
      const ap = ctx.createBiquadFilter();
      ap.type = "allpass";
      ap.frequency.value = 480 + i * 420;
      ap.Q.value = 1.2;
      phNode.connect(ap);
      phNode = ap;
      phasers.push(ap);
    }
    const phaserLfo = ctx.createOscillator();
    phaserLfo.type = "sine";
    phaserLfo.frequency.value = 0.22;
    const phDepth = ctx.createGain();
    phDepth.gain.value = 700;
    phaserLfo.connect(phDepth);
    for (const ap of phasers) phDepth.connect(ap.frequency);
    phaserLfo.start();
    const phaserGain = ctx.createGain();
    phaserGain.gain.value = 0;
    phNode.connect(phaserGain);

    const master = ctx.createGain();
    master.gain.value = 0.85;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.12;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0.05;

    const drum = ctx.createGain();
    drum.gain.value = 0.95;
    drum.connect(dry);
    drum.connect(delay);
    drum.connect(conv);

    voice.connect(dry);
    voice.connect(chorusDelay);
    chorusDelay.connect(chorusGain);
    voice.connect(delay);
    voice.connect(conv);
    voice.connect(phaserIn);
    dry.connect(master);
    chorusGain.connect(master);
    delayWet.connect(master);
    revWet.connect(master);
    phaserGain.connect(master);
    master.connect(limiter);
    limiter.connect(analyser);
    analyser.connect(ctx.destination);
    this.hookIosSpeaker(analyser);

    this.analyser = analyser;
    this.buses = {
      voice,
      chorusDelay,
      chorusLfo,
      chorusGain,
      delay,
      delayFb,
      delayWet,
      conv,
      revWet,
      dry,
      drum,
      master,
      limiter,
      phaserGain,
      phaserLfo,
    };

    const lfo1 = ctx.createOscillator();
    lfo1.type = "sine";
    lfo1.frequency.value = 0.35;
    lfo1.start();
    const lfo2 = ctx.createOscillator();
    lfo2.type = "triangle";
    lfo2.frequency.value = 0.35;
    lfo2.start();
    const drift = ctx.createOscillator();
    drift.type = "sine";
    drift.frequency.value = 0.11;
    drift.start();
    const sh1 = ctx.createConstantSource();
    sh1.offset.value = 0;
    sh1.start();
    const sh2 = ctx.createConstantSource();
    sh2.offset.value = 0;
    sh2.start();
    this.lfos = { lfo1, lfo2, drift, sh1, sh2 };
    this.startShClock();

    const mod = ctx.createConstantSource();
    mod.offset.value = 0;
    mod.start();
    const at = ctx.createConstantSource();
    at.offset.value = 0;
    at.start();
    this.dc = { mod, at };

    this.drums = new DrumVoice(ctx, drum);
    this.started = true;
    this.applyPatch(this.patch);
    listener.onState?.(ctx.state);
  }

  get voiceCount() {
    return this.voices.length;
  }

  get running() {
    return this.ctx.state === "running";
  }

  get audioContext() {
    return this.ctx;
  }

  canSetSink() {
    return typeof (this.ctx as AudioContext & { setSinkId?: unknown }).setSinkId === "function";
  }

  async setSink(id: string) {
    const ctx = this.ctx as AudioContext & { setSinkId?: (s: string) => Promise<void> };
    if (typeof ctx.setSinkId !== "function") return false;
    kickContext(this.ctx);
    await ctx.setSinkId(id);
    return true;
  }

  private hookIosSpeaker(analyser: AnalyserNode) {
    if (!isIosTouch()) return;
    try {
      analyser.disconnect(this.ctx.destination);
    } catch {
      /* */
    }
    const dest = this.ctx.createMediaStreamDestination();
    analyser.connect(dest);
    const el = document.createElement("audio");
    el.autoplay = true;
    el.preload = "auto";
    el.controls = false;
    el.muted = false;
    el.volume = 1;
    el.setAttribute("playsinline", "true");
    el.setAttribute("webkit-playsinline", "true");
    el.srcObject = dest.stream;
    el.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:0;bottom:0";
    document.body.appendChild(el);
    void el.play().catch(() => {
      /* next resume() */
    });
    this.iosEl = el;
    this.iosDest = dest;
  }

  setIosLowLat(on: boolean) {
    if (!this.iosEl || !this.iosDest) return;
    try {
      this.analyser.disconnect(this.iosDest);
    } catch {
      /* */
    }
    try {
      this.analyser.disconnect(this.ctx.destination);
    } catch {
      /* */
    }
    if (on) {
      this.analyser.connect(this.ctx.destination);
      this.iosEl.muted = true;
      this.iosEl.pause();
    } else {
      this.analyser.connect(this.iosDest);
      this.iosEl.muted = false;
      void this.iosEl.play().catch(() => {
        /* */
      });
    }
  }

  private startShClock() {
    if (this.shTimer != null) return;
    this.shLast = performance.now();
    const tick = () => {
      const t = performance.now();
      const dt = Math.min(0.05, (t - this.shLast) / 1000);
      this.shLast = t;
      const p = this.patch;
      const now = this.ctx.currentTime;
      if (p.lfo.wave === "samplehold") {
        this.shAcc1 += dt * clamp(p.lfo.rate, 0.05, 30);
        if (this.shAcc1 >= 1) {
          this.shAcc1 %= 1;
          try {
            this.lfos.sh1.offset.setValueAtTime(Math.random() * 2 - 1, now);
          } catch {
            /* */
          }
        }
      }
      if (p.lfo2.wave === "samplehold") {
        this.shAcc2 += dt * clamp(p.lfo2.rate, 0.05, 30);
        if (this.shAcc2 >= 1) {
          this.shAcc2 %= 1;
          try {
            this.lfos.sh2.offset.setValueAtTime(Math.random() * 2 - 1, now);
          } catch {
            /* */
          }
        }
      }
      this.tickShape(dt, now);
      this.shTimer = window.setTimeout(tick, 16);
    };
    tick();
  }

  private tickShape(dt: number, now: number) {
    const live = this.voices.filter((v) => v.alive);
    const jobs: { sh: DrawShape; y: number }[] = [];
    const run = (sh: DrawShape | undefined, clock: "1" | "2") => {
      if (!sh?.on || sh.depth < 0.008) {
        if (clock === "1") this.shapePhase = 0;
        else this.shapePhase2 = 0;
        return;
      }
      const dur = Math.max(0.15, sh.time);
      if (sh.mode === "loop") {
        if (clock === "1") {
          this.shapeClock = (this.shapeClock + dt / dur) % 1;
          this.shapePhase = this.shapeClock;
        } else {
          this.shapeClock2 = (this.shapeClock2 + dt / dur) % 1;
          this.shapePhase2 = this.shapeClock2;
        }
        const y = sampleShape(sh.points, clock === "1" ? this.shapePhase : this.shapePhase2, sh.from ?? 0);
        jobs.push({ sh, y });
        return;
      }
      let lead = 0;
      for (const v of live) {
        const t = Math.min(1, Math.max(0, (now - v.startedAt) / dur));
        lead = Math.max(lead, t);
      }
      if (clock === "1") this.shapePhase = live.length ? lead : 0;
      else this.shapePhase2 = live.length ? lead : 0;
      for (const v of live) {
        /* env is per-voice — applied below */
      }
      jobs.push({ sh, y: 0, env: true } as { sh: DrawShape; y: number });
    };
    run(this.patch.drawShape, "1");
    run(this.patch.drawShape2, "2");
    if (!jobs.length) {
      const rest: DrawShape = { on: false, mode: "env", dest: "amp", dest2: "off", time: 1, depth: 0, from: 0, points: [1] };
      for (const v of this.voices) if (v.alive) v.applyShapes([{ sh: rest, y: 1 }], now);
      return;
    }
    for (const v of live) {
      const per = jobs.map(({ sh }) => {
        if (sh.mode === "loop") {
          const phase = sh === this.patch.drawShape2 ? this.shapePhase2 : this.shapePhase;
          return { sh, y: sampleShape(sh.points, phase, sh.from ?? 0) };
        }
        const t = Math.min(1, Math.max(0, (now - v.startedAt) / Math.max(0.15, sh.time)));
        return { sh, y: sampleShape(sh.points, t, sh.from ?? 0) };
      });
      v.applyShapes(per, now);
    }
  }

  applyPatch(p: Patch) {
    this.patch = clonePatch(p);
    const now = this.ctx.currentTime;
    const fx = this.patch.fx;
    this.buses.delayWet.gain.setTargetAtTime(fx.delayMix, now, 0.03);
    this.buses.delay.delayTime.setTargetAtTime(clamp(fx.delayTime, 0.05, 1.1), now, 0.04);
    this.buses.delayFb.gain.setTargetAtTime(clamp(fx.delayFeedback, 0, 0.85), now, 0.03);
    this.buses.revWet.gain.setTargetAtTime(fx.reverbMix, now, 0.04);
    this.buses.chorusGain.gain.setTargetAtTime(fx.chorusMix * 0.7, now, 0.04);
    this.buses.phaserGain.gain.setTargetAtTime((fx.phaserMix ?? 0) * 0.65, now, 0.04);
    this.applyOutGain(now);
    this.lfos.lfo1.frequency.setTargetAtTime(clamp(this.patch.lfo.rate, 0.02, 30), now, 0.02);
    try {
      this.lfos.lfo1.type = oscLfoType(this.patch.lfo.wave);
    } catch {
      /* */
    }
    this.lfos.lfo2.frequency.setTargetAtTime(clamp(this.patch.lfo2.rate, 0.02, 30), now, 0.02);
    try {
      this.lfos.lfo2.type = oscLfoType(this.patch.lfo2.wave);
    } catch {
      /* */
    }
    for (const v of this.voices) {
      const live =
        v.layer === "b" ? this.stack.b.patch : v.layer === "a" ? this.stack.a.patch : v.patchSnap;
      const hz = cutoffHz(live.filter.cutoff + this.cutoffMod * 0.35, live.filter.keyTrack, v.midi);
      v.setCutoff(hz, 0.2 + live.filter.resonance * 18, now);
      v.setTone(live.filter.tone ?? 0.5, now);
      v.setWaveShape("osc1", live.osc1);
      v.setWaveShape("osc2", live.osc2);
    }
    if (this.patch.arp.on) {
      this.absorbHeldIntoArp();
      if (!this.patch.arp.hold) {
        this.arpHeld = this.arpHeld.filter((n) => this.arpPhysical.has(n) || this.sustained.has(n));
        if (this.arpHeld.length === 0) this.stopArp();
        else this.ensureArp();
      } else {
        this.ensureArp();
      }
    } else {
      this.stopArp();
      this.arpHeld = [...this.arpPhysical];
    }
    if (this.patch.polyMode === "poly") this.monoStack = [];
    const g = this.patch.groove ?? defaultGroove();
    if (this.groovePlaying && (g.seqOn || g.drumsOn)) this.ensureGroove();
    else if (!g.seqOn && !g.drumsOn) this.stopGroove();
    for (let t = 0; t < 4; t++) {
      if (!g.mute[t]) continue;
      for (const v of this.seqByTrack[t] ?? []) v.release(this.patch);
      this.seqByTrack[t] = [];
    }
  }

  setCutoffMod(v: number) {
    this.cutoffMod = clamp(v, 0, 1);
    const now = this.ctx.currentTime;
    this.dc.mod.offset.setTargetAtTime(this.cutoffMod, now, 0.03);
    for (const vo of this.voices) {
      const p =
        vo.layer === "b" ? this.stack.b.patch : vo.layer === "a" ? this.stack.a.patch : vo.patchSnap;
      const hz = cutoffHz(p.filter.cutoff + this.cutoffMod * 0.4, p.filter.keyTrack, vo.midi);
      vo.setCutoff(hz, 0.2 + p.filter.resonance * 18, now);
    }
  }

  setAftertouch(v: number) {
    this.dc.at.offset.setTargetAtTime(clamp(v, 0, 1), this.ctx.currentTime, 0.025);
  }

  setHostTempo(bpm: number | null) {
    this.hostBpm = bpm != null && bpm >= 40 && bpm <= 300 ? bpm : null;
  }

  setMaster(v: number) {
    this.patch.master = v;
    this.applyOutGain();
  }

  setOutputVol(v: number) {
    this.outputVol = clamp(v, 0, 1);
    this.applyOutGain();
  }

  private applyOutGain(now = this.ctx.currentTime) {
    const g = this.muted ? 0 : clamp(this.patch.master, 0, 1) * clamp(this.outputVol, 0, 1);
    this.buses.master.gain.setTargetAtTime(g, now, 0.03);
  }

  setMuted(on: boolean) {
    this.muted = on;
    this.applyOutGain();
  }

  setStack(next: EngineStack) {
    this.stack = next;
    const now = this.ctx.currentTime;
    for (const v of this.voices) {
      if (v.layer === "seq") continue;
      const L = v.layer === "b" ? next.b : next.a;
      v.setMix(L.level, L.pan, now);
      if (!L.on && v.live) v.release(L.patch);
    }
  }

  setBank(list: Patch[]) {
    this.bank = Array.isArray(list) ? list : [];
  }

  setBend(semis: number) {
    this.bend = semis;
    const now = this.ctx.currentTime;
    for (const v of this.voices) v.setBend(semis, now);
  }

  setSustain(on: boolean) {
    this.sustain = on;
    if (on) return;
    for (const n of [...this.sustained]) {
      this.sustained.delete(n);
      if (this.patch.arp.on) {
        if (!this.patch.arp.hold && !this.arpPhysical.has(n)) {
          this.arpHeld = this.arpHeld.filter((x) => x !== n);
        }
      } else if (!this.held.has(n)) {
        this.releaseNote(n);
      }
    }
    if (this.patch.arp.on && !this.patch.arp.hold && this.arpHeld.length === 0) this.stopArp();
    if (this.patch.polyMode !== "poly" && this.monoStack.length === 0) this.monoVoice?.release(this.patch);
  }

  noteOn(midi: number, velocity = 0.85) {
    kickContext(this.ctx);
    if (!this.stack.a.on && !this.stack.b.on) return;
    if (this.patch.arp.on) {
      const replace = this.patch.arp.hold && this.arpPhysical.size === 0 && !this.sustain;
      if (replace) this.arpHeld = [];
      if (!this.arpHeld.includes(midi)) this.arpHeld.push(midi);
      this.arpPhysical.add(midi);
      this.held.set(midi, "arp");
      this.ensureArp();
      return;
    }
    const now = this.ctx.currentTime;
    if (!this.stack.b.on) {
      if (!this.stack.a.on) return;
      if (this.patch.polyMode === "poly") {
        this.spawn(midi, velocity, now);
        return;
      }

      this.monoStack = this.monoStack.filter((n) => n !== midi);
      const overlapping = this.monoStack.length > 0 && !!this.monoVoice?.live;
      this.monoStack.push(midi);

      if (this.patch.polyMode === "legato" && overlapping && this.monoVoice) {
        this.monoVoice.glideTo(midi, this.bend, this.patch, now, true);
        this.held.set(midi, [this.monoVoice]);
        return;
      }

      if (this.monoVoice?.live) this.monoVoice.release(this.patch);
      this.spawn(midi, velocity, now);
      return;
    }

    const created: Voice[] = [];
    for (const L of layersForNote(this.stack, midi)) {
      created.push(this.spawnOne(midi, velocity, now, L));
    }
    if (created.length) this.held.set(midi, created);
  }

  noteOff(midi: number) {
    this.arpPhysical.delete(midi);
    this.held.delete(midi);
    this.monoStack = this.monoStack.filter((n) => n !== midi);
    if (this.patch.arp.on) {
      if (this.sustain && !this.patch.arp.hold) {
        this.sustained.add(midi);
        return;
      }
      if (!this.patch.arp.hold) {
        this.arpHeld = this.arpHeld.filter((n) => n !== midi);
        if (this.arpHeld.length === 0) this.stopArp();
      }
      return;
    }
    if (this.sustain) {
      this.sustained.add(midi);
      return;
    }
    if (this.stack.b.on) {
      this.releaseNote(midi);
      return;
    }
    if (this.patch.polyMode === "poly") {
      this.releaseNote(midi);
      return;
    }
    this.advanceMono();
  }

  panic() {
    for (const v of [...this.voices]) v.kill();
    this.voices = [];
    this.held.clear();
    this.sustained.clear();
    this.monoStack = [];
    this.arpHeld = [];
    this.arpPhysical.clear();
    this.stopArp();
    this.stopGroove();
    this.monoVoice = null;
    this.arpVoices = [];
    this.dc.at.offset.setValueAtTime(0, this.ctx.currentTime);
    this.dc.mod.offset.setValueAtTime(0, this.ctx.currentTime);
    this.cutoffMod = 0;
    this.listener.onVoices?.(0);
  }

  resume() {
    kickContext(this.ctx);
    void this.iosEl?.play().catch(() => {
      /* */
    });
  }

  private advanceMono() {
    const now = this.ctx.currentTime;
    const next = this.monoStack[this.monoStack.length - 1];
    const live = this.monoVoice?.live ? this.monoVoice : null;
    if (next != null && live) {
      if (this.patch.polyMode === "legato") {
        live.glideTo(next, this.bend, this.patch, now, true);
        return;
      }
      live.release(this.patch);
      this.spawn(next, 0.85, now);
      return;
    }
    this.monoVoice?.release(this.patch);
  }

  private releaseNote(midi: number) {
    for (const v of this.voices) {
      if (v.midi === midi && !v.releasing) v.release(this.patch);
    }
  }

  private spawn(midi: number, velocity: number, now: number) {
    const v = this.spawnOne(midi, velocity, now, {
      id: "a",
      on: this.stack.a.on,
      level: this.stack.a.level,
      pan: this.stack.a.pan,
      patch: this.patch,
    });
    this.held.set(midi, [v]);
    if (this.patch.polyMode !== "poly") this.monoVoice = v;
  }

  private spawnOne(midi: number, velocity: number, now: number, L: EngineLayer, mix: "a" | "b" | "seq" = L.id) {
    while (this.voices.length >= (isAndroid() ? MAX_VOICES_ANDROID : MAX_VOICES)) {
      const oldest = this.voices[0];
      if (isAndroid() && oldest && !oldest.releasing) oldest.release(this.patch);
      else oldest?.kill();
    }
    const v = new Voice(
      this.ctx,
      this.buses.voice,
      this.lfos,
      L.patch,
      midi,
      velocity,
      this.bend,
      this.dc,
      now,
      () => {
        this.voices = this.voices.filter((x) => x !== v);
        if (this.monoVoice === v) this.monoVoice = null;
        if (this.arpVoice === v) this.arpVoice = null;
        this.arpVoices = this.arpVoices.filter((x) => x !== v);
        this.listener.onVoices?.(this.voices.length);
      },
      { id: mix, gain: L.level, pan: L.pan },
    );
    this.voices.push(v);
    this.listener.onVoices?.(this.voices.length);
    return v;
  }

  private absorbHeldIntoArp() {
    for (const [midi, v] of [...this.held.entries()]) {
      if (v === "arp") continue;
      for (const voice of v) voice.release(this.patch);
      if (!this.arpHeld.includes(midi)) this.arpHeld.push(midi);
      this.arpPhysical.add(midi);
      this.held.set(midi, "arp");
    }
  }

  private ensureArp() {
    if (this.arpTimer != null) return;
    this.arpTick();
  }

  private stopArp() {
    if (this.arpTimer != null) {
      window.clearTimeout(this.arpTimer);
      this.arpTimer = null;
    }
    this.arpVoice?.release(this.patch);
    this.arpVoice = null;
    for (const v of this.arpVoices) v.release(this.patch);
    this.arpVoices = [];
    this.arpIndex = 0;
    this.arpDir = 1;
    this.arpNoteCursor = 0;
    this.arpBag = [];
    this.arpBagKey = "";
    this.listener.onArpStep?.(-1, null);
  }

  private arpTick = () => {
    if (!this.patch.arp.on || this.arpHeld.length === 0 || (!this.stack.a.on && !this.stack.b.on)) {
      this.stopArp();
      return;
    }
    const notes = this.orderArp([...this.arpHeld]);
    const oct = this.patch.arp.octaves;
    const expanded: number[] = [];
    for (let o = 0; o < oct; o++) for (const n of notes) expanded.push(n + o * 12);
    if (expanded.length === 0) {
      this.stopArp();
      return;
    }

    const tempo = this.hostBpm ?? this.patch.arp.tempo;
    const stepDur = (60 / tempo) * (ARP_DIV[this.patch.arp.rate] ?? 0.25);
    const usePat = this.patch.arp.pattern;
    const si = usePat ? this.arpIndex % 16 : this.arpIndex;
    const st: ArpStep = usePat
      ? (this.patch.arp.steps[si] ?? { on: true, accent: false, oct: 0 })
      : { on: true, accent: false, oct: 0 };
    const swing = si % 2 === 1 ? stepDur * this.patch.arp.swing * 0.5 : 0;
    const gate = clamp(this.patch.arp.gate, 0.1, 0.95);
    const now = this.ctx.currentTime;

    if (st.on) {
      let note: number;
      if (usePat) {
        const base = expanded[this.arpNoteCursor % expanded.length] ?? expanded[0]!;
        note = clamp(base + st.oct * 12, 0, 127);
        this.arpNoteCursor = (this.arpNoteCursor + 1) % expanded.length;
      } else {
        note = expanded[this.arpIndex] ?? expanded[0]!;
      }
      const vel = st.accent ? 1 : 0.82;
      for (const v of this.arpVoices) v.release(this.patch);
      const specs = layersForNote(this.stack, note);
      const created: Voice[] = [];
      for (const L of specs) {
        created.push(this.spawnOne(note, vel, now, L));
      }
      this.arpVoices = created;
      this.arpVoice = created[0] ?? null;
      this.listener.onArpStep?.(usePat ? si : this.arpIndex, note);
      window.setTimeout(() => {
        for (const voice of created) voice.release(this.patch);
      }, (stepDur * gate + swing) * 1000);
    } else {
      this.listener.onArpStep?.(si, null);
    }

    if (!usePat && this.patch.arp.mode === "updown") {
      this.arpIndex += this.arpDir;
      if (this.arpIndex >= expanded.length - 1) this.arpDir = -1;
      if (this.arpIndex <= 0) this.arpDir = 1;
    } else if (usePat) {
      this.arpIndex = (this.arpIndex + 1) % 16;
      if (this.arpIndex === 0) this.arpBag = [];
    } else {
      this.arpIndex = (this.arpIndex + 1) % expanded.length;
      if (this.arpIndex === 0) this.arpBag = [];
    }
    this.arpTimer = window.setTimeout(this.arpTick, (stepDur + swing) * 1000);
  };

  hitDrum(part: DrumPart, vel = 0.85) {
    kickContext(this.ctx);
    const g = this.patch.groove ?? defaultGroove();
    if (g.drumMute[part]) return;
    this.drums?.hit(part, vel, g.kit, this.ctx.currentTime);
  }

  setClickOn(on: boolean) {
    this.clickOn = on;
  }

  private ensureClick() {
    if (this.clickGain) return;
    const g = this.ctx.createGain();
    g.gain.value = 0.28;
    g.connect(this.buses.master);
    this.clickGain = g;
  }

  private blip(accent: boolean, now: number) {
    this.ensureClick();
    const o = this.ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = accent ? 1760 : 990;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(accent ? 0.85 : 0.4, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
    o.connect(g);
    g.connect(this.clickGain!);
    o.start(now);
    o.stop(now + 0.06);
  }

  countIn(then: () => void) {
    kickContext(this.ctx);
    if (this.countTimer != null) window.clearTimeout(this.countTimer);
    const tempo = this.hostBpm ?? this.patch.arp.tempo;
    const beat = 60 / Math.max(40, tempo);
    const t0 = this.ctx.currentTime + 0.02;
    for (let i = 0; i < 4; i++) this.blip(i === 0, t0 + i * beat);
    this.countTimer = window.setTimeout(() => {
      this.countTimer = null;
      then();
    }, Math.round(4 * beat * 1000));
  }

  startBounce() {
    if (this.recNode) return;
    kickContext(this.ctx);
    const proc = this.ctx.createScriptProcessor(4096, 2, 2);
    this.recL = [];
    this.recR = [];
    this.bouncing = true;
    proc.onaudioprocess = (ev) => {
      if (!this.bouncing) return;
      this.recL.push(new Float32Array(ev.inputBuffer.getChannelData(0)));
      this.recR.push(new Float32Array(ev.inputBuffer.getChannelData(1)));
      let n = 0;
      for (const c of this.recL) n += c.length;
      if (n > this.ctx.sampleRate * 180) this.stopBounce();
    };
    const silent = this.ctx.createGain();
    silent.gain.value = 0;
    this.buses.limiter.connect(proc);
    proc.connect(silent);
    silent.connect(this.ctx.destination);
    this.recNode = proc;
    this.recSilent = silent;
  }

  stopBounce(): Blob | null {
    this.bouncing = false;
    const proc = this.recNode;
    const silent = this.recSilent;
    this.recNode = null;
    this.recSilent = null;
    try {
      proc?.disconnect();
      silent?.disconnect();
    } catch {
      /* */
    }
    if (!this.recL.length) return null;
    const L = mergeChunks(this.recL);
    const R = mergeChunks(this.recR.length ? this.recR : this.recL);
    this.recL = [];
    this.recR = [];
    return encodeWavStereo(L, R, this.ctx.sampleRate);
  }

  setGroovePlaying(on: boolean) {
    const g = this.patch.groove ?? defaultGroove();
    if (!on && this.countTimer != null) {
      window.clearTimeout(this.countTimer);
      this.countTimer = null;
    }
    this.groovePlaying = on;
    if (on && (g.seqOn || g.drumsOn)) {
      if (this.grooveTimer == null) this.grooveIndex = 0;
      this.ensureGroove();
    } else if (!on) {
      this.stopGroove();
    }
  }

  /** Playhead in 16th-notes (float). */
  groovePos() {
    const g = this.patch.groove ?? defaultGroove();
    const len = Math.max(1, stepsOf(g));
    if (!this.groovePlaying) return 0;
    const tempo = this.hostBpm ?? this.patch.arp.tempo;
    const stepDur = (60 / Math.max(40, tempo)) * 0.25;
    const elapsed = Math.max(0, (performance.now() - this.grooveTickAt) / 1000);
    return (this.grooveNow + Math.min(elapsed / Math.max(0.001, stepDur), 0.999)) % len;
  }

  private ensureGroove() {
    if (this.grooveTimer != null) return;
    this.grooveTick();
  }

  private clearClipTimers() {
    for (const id of this.clipTimers) window.clearTimeout(id);
    this.clipTimers = [];
  }

  private seqSpec(track: number): { layer: EngineLayer; mix: "a" | "b" | "seq" } | null {
    const g = this.patch.groove ?? defaultGroove();
    const id = g.trackSound?.[track] ?? (g.target === "b" ? "b" : "a");
    if (id === "a") return this.stack.a.on ? { layer: this.stack.a, mix: "a" } : null;
    if (id === "b") return this.stack.b.on ? { layer: this.stack.b, mix: "b" } : null;
    const p = this.bank.find((x) => x.id === id);
    if (!p) return this.stack.a.on ? { layer: this.stack.a, mix: "a" } : null;
    return { layer: { id: "a", on: true, level: 1, pan: 0, patch: p }, mix: "seq" };
  }

  private stopGroove() {
    if (this.grooveTimer != null) {
      window.clearTimeout(this.grooveTimer);
      this.grooveTimer = null;
    }
    this.clearClipTimers();
    for (const v of this.seqVoices) v.release(this.patch);
    this.seqVoices = [];
    this.seqByTrack = [[], [], [], []];
    this.groovePlaying = false;
    this.listener.onGrooveStep?.(-1);
  }

  private grooveTick = () => {
    const g = this.patch.groove ?? defaultGroove();
    if (!this.groovePlaying || (!g.seqOn && !g.drumsOn)) {
      this.stopGroove();
      return;
    }
    const len = Math.max(1, stepsOf(g));
    const i = this.grooveIndex % len;
    const tempo = this.hostBpm ?? this.patch.arp.tempo;
    const stepDur = (60 / Math.max(40, tempo)) * 0.25;
    const swing = i % 2 === 1 ? stepDur * this.patch.arp.swing * 0.5 : 0;
    const now = this.ctx.currentTime;
    this.grooveNow = i;
    this.grooveTickAt = performance.now();

    if (this.clickOn && i % 4 === 0) this.blip(i % 16 === 0, now);

    if (g.drumsOn) {
      for (const part of DRUM_PARTS) {
        if (g.drumMute[part]) continue;
        const hit = g.drums[part][i];
        if (hit?.on) this.drums?.hit(part, hit.vel, g.kit, now);
      }
    }

    if (g.seqOn) {
      for (let t = 0; t < 4; t++) {
        if (g.mute[t]) {
          for (const v of this.seqByTrack[t] ?? []) v.release(this.patch);
          this.seqByTrack[t] = [];
          continue;
        }
        const clips = g.tracks[t] ?? [];
        for (const n of clips) {
          const start = ((n.start % len) + len) % len;
          if (Math.floor(start) !== i) continue;
          const delayMs = Math.max(0, (start - i) * stepDur) * 1000;
          const holdMs = Math.max(40, n.dur * stepDur * 1000);
          const track = t;
          const fire = () => {
            const live = this.patch.groove ?? defaultGroove();
            if (!this.groovePlaying || live.mute[track]) return;
            const spec = this.seqSpec(track);
            if (!spec) return;
            const created: Voice[] = [this.spawnOne(n.note, n.vel, this.ctx.currentTime, spec.layer, spec.mix)];
            this.seqByTrack[track] = [...(this.seqByTrack[track] ?? []), ...created];
            this.seqVoices = this.seqByTrack.flat();
            const rid = window.setTimeout(() => {
              for (const v of created) v.release(this.patch);
              this.seqByTrack[track] = (this.seqByTrack[track] ?? []).filter((v) => !created.includes(v));
              this.seqVoices = this.seqByTrack.flat();
            }, holdMs);
            this.clipTimers.push(rid);
          };
          if (delayMs < 4) fire();
          else this.clipTimers.push(window.setTimeout(fire, delayMs));
        }
      }
      this.seqVoices = this.seqByTrack.flat();
    }

    this.listener.onGrooveStep?.(i);
    this.grooveIndex = (i + 1) % len;
    this.grooveTimer = window.setTimeout(this.grooveTick, (stepDur + swing) * 1000);
  };

  private orderArp(notes: number[]): number[] {
    const s = [...notes].sort((a, b) => a - b);
    switch (this.patch.arp.mode) {
      case "down":
        return s.reverse();
      case "random": {
        const key = s.join(",");
        if (this.arpBagKey !== key || this.arpBag.length === 0) {
          this.arpBagKey = key;
          this.arpBag = shuffle(s);
        }
        return this.arpBag;
      }
      case "asplayed":
        return notes;
      default:
        return s;
    }
  }
}

/** Synchronous — call only from a click / key / pointer handler. */
export function createEngine(listener?: EngineListener): LyraEngine {
  const ctx = makeAudioContext();
  kickContext(ctx);
  return new LyraEngine(ctx, listener);
}
