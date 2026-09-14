import type { LfoDest, LfoParams, Patch, Waveform } from "./types";
import { midiToFreq } from "./midi";
import { INIT_PATCH, clonePatch } from "./patches";

const MAX_VOICES = 32;
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

const ARP_DIV: Record<string, number> = {
  "1/4": 1,
  "1/8": 0.5,
  "1/8t": 1 / 3,
  "1/16": 0.25,
  "1/16t": 1 / 6,
};

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
  try {
    return new AC({ latencyHint: "interactive" });
  } catch {
    return new AC();
  }
}

type LfoBank = { lfo1: OscillatorNode; lfo2: OscillatorNode; drift: OscillatorNode };

class Voice {
  midi: number;
  readonly startedAt: number;
  releasing = false;
  private ctx: AudioContext;
  private vca: GainNode;
  private filters: BiquadFilterNode[];
  private oscs: OscillatorNode[] = [];
  private osc1s: OscillatorNode[] = [];
  private osc2s: OscillatorNode[] = [];
  private subs: OscillatorNode[] = [];
  private sources: AudioScheduledSourceNode[] = [];
  private mix: GainNode;
  private pan: StereoPannerNode;
  private fmGain: GainNode | null = null;
  private dead = false;
  private onEnded: () => void;
  private releaseTimer: number | null = null;
  private extras: AudioNode[] = [];

  constructor(
    ctx: AudioContext,
    dest: AudioNode,
    lfos: LfoBank,
    patch: Patch,
    midi: number,
    velocity: number,
    bend: number,
    modWheel: number,
    now: number,
    onEnded: () => void,
  ) {
    this.ctx = ctx;
    this.midi = midi;
    this.startedAt = now;
    this.onEnded = onEnded;

    this.mix = ctx.createGain();
    this.vca = ctx.createGain();
    this.pan = ctx.createStereoPanner();
    this.vca.gain.setValueAtTime(0.0001, now);

    const shaper = ctx.createWaveShaper();
    shaper.curve = tanhCurve(patch.drive) as Float32Array<ArrayBuffer>;
    shaper.oversample = "none";

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

    this.mix.connect(shaper);
    shaper.connect(this.filters[0]!);
    for (let i = 0; i < this.filters.length - 1; i++) this.filters[i]!.connect(this.filters[i + 1]!);
    this.filters[this.filters.length - 1]!.connect(this.vca);
    this.vca.connect(this.pan);
    this.pan.connect(dest);

    const uni = patch.unison.voices;
    this.spawnOsc(patch, "osc1", midi, bend, now, uni);
    this.spawnOsc(patch, "osc2", midi, bend, now, uni);

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

    this.routeLfo(lfos.lfo1, patch.lfo, 1);
    this.routeLfo(lfos.lfo2, patch.lfo2, 1);
    for (const row of patch.matrix ?? []) {
      if (Math.abs(row.amount) < 0.01) continue;
      if (row.src === "lfo1") this.routeLfo(lfos.lfo1, { ...patch.lfo, dest: row.dest, depth: row.amount }, 1);
      else if (row.src === "lfo2") this.routeLfo(lfos.lfo2, { ...patch.lfo2, dest: row.dest, depth: row.amount }, 1);
      else if (row.src === "mod" && row.dest === "cutoff") {
        const extra = cutoffHz(clamp(patch.filter.cutoff + modWheel * row.amount * 0.4, 0, 1), patch.filter.keyTrack, midi);
        for (const f of this.filters) f.frequency.setTargetAtTime(extra, now, 0.02);
      }
    }

    const peak = vel * 0.38;
    const a = Math.max(0.003, patch.ampEnv.attack);
    const d = Math.max(0.01, patch.ampEnv.decay);
    const s = Math.max(0.0001, patch.ampEnv.sustain * peak);
    this.vca.gain.setValueAtTime(0.0001, now);
    this.vca.gain.linearRampToValueAtTime(peak, now + a);
    this.vca.gain.setTargetAtTime(s, now + a, d / 3);
  }

  private routeLfo(lfo: OscillatorNode, spec: LfoParams, scale: number) {
    const depth = (spec?.depth ?? 0) * scale;
    if (!spec || Math.abs(depth) < 0.008) return;
    const ctx = this.ctx;
    const g = ctx.createGain();
    const dest: LfoDest = spec.dest ?? "cutoff";
    if (dest === "cutoff") {
      g.gain.value = depth * 2400;
      lfo.connect(g);
      for (const f of this.filters) g.connect(f.detune);
    } else if (dest === "pitch") {
      g.gain.value = depth * 40;
      lfo.connect(g);
      for (const o of this.oscs) g.connect(o.detune);
    } else if (dest === "pan") {
      g.gain.value = depth * 0.75;
      lfo.connect(g);
      g.connect(this.pan.pan);
    } else if (dest === "amp") {
      g.gain.value = depth * 0.22;
      lfo.connect(g);
      g.connect(this.vca.gain);
    } else if (dest === "res") {
      g.gain.value = depth * 10;
      lfo.connect(g);
      for (const f of this.filters) g.connect(f.Q);
    } else if (dest === "fm" && this.fmGain) {
      g.gain.value = depth * 800;
      lfo.connect(g);
      g.connect(this.fmGain.gain);
    } else {
      return;
    }
    this.extras.push(g);
  }

  private spawnOsc(patch: Patch, which: "osc1" | "osc2", midi: number, bend: number, now: number, uni: number) {
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
    for (let i = 0; i < copies; i++) {
      const o = ctx.createOscillator();
      applyWave(ctx, o, p.wave, p.pwm);
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

  setBend(semis: number, when: number) {
    const ratio = Math.pow(2, semis / 12);
    for (const o of this.oscs) {
      try {
        const f = o.frequency.value;
        o.frequency.setTargetAtTime(f * ratio, when, 0.01);
      } catch {
        /* closed */
      }
    }
  }

  setCutoff(hz: number, q: number, when: number) {
    for (const f of this.filters) {
      f.frequency.setTargetAtTime(clamp(hz, 20, 18000), when, 0.02);
      f.Q.setTargetAtTime(q, when, 0.03);
    }
  }

  glideTo(midi: number, bend: number, patch: Patch, when: number, portamento: boolean) {
    this.midi = midi;
    const glide = patch.glide ?? 0;
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
      this.mix.disconnect();
      this.pan.disconnect();
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

function applyWave(ctx: AudioContext, o: OscillatorNode, wave: Waveform, pwm: number) {
  if (wave === "pulse") {
    o.setPeriodicWave(pulseWave(ctx, pwm));
    return;
  }
  if (wave === "wt") {
    o.setPeriodicWave(wtWave(ctx, pwm));
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
  onState?: (state: AudioContextState) => void;
};

export class LyraEngine {
  ctx: AudioContext;
  analyser: AnalyserNode;
  private patch: Patch = clonePatch(INIT_PATCH);
  private voices: Voice[] = [];
  private held = new Map<number, Voice | "arp">();
  private sustain = false;
  private sustained = new Set<number>();
  private bend = 0;
  private cutoffMod = 0;
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
    master: GainNode;
    limiter: DynamicsCompressorNode;
    phaserGain: GainNode;
    phaserLfo: OscillatorNode;
  };
  private lfos: LfoBank;
  private arpHeld: number[] = [];
  private arpTimer: number | null = null;
  private arpIndex = 0;
  private arpDir = 1;
  private arpVoice: Voice | null = null;
  private monoVoice: Voice | null = null;
  private monoStack: number[] = [];
  private listener: EngineListener;
  private started = false;
  private hostBpm: number | null = null;

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
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.35;

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
    this.lfos = { lfo1, lfo2, drift };

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
    this.buses.master.gain.setTargetAtTime(clamp(this.patch.master, 0, 1), now, 0.03);
    this.lfos.lfo1.frequency.setTargetAtTime(clamp(this.patch.lfo.rate, 0.02, 30), now, 0.02);
    this.lfos.lfo1.type = this.patch.lfo.wave;
    this.lfos.lfo2.frequency.setTargetAtTime(clamp(this.patch.lfo2.rate, 0.02, 30), now, 0.02);
    this.lfos.lfo2.type = this.patch.lfo2.wave;
    const q = 0.2 + this.patch.filter.resonance * 18;
    for (const v of this.voices) {
      const hz = cutoffHz(this.patch.filter.cutoff + this.cutoffMod * 0.35, this.patch.filter.keyTrack, v.midi);
      v.setCutoff(hz, q, now);
    }
    if (this.patch.arp.on) this.ensureArp();
    else this.stopArp();
    if (this.patch.polyMode === "poly") this.monoStack = [];
  }

  setCutoffMod(v: number) {
    this.cutoffMod = clamp(v, 0, 1);
    const now = this.ctx.currentTime;
    const q = 0.2 + this.patch.filter.resonance * 18;
    for (const vo of this.voices) {
      const hz = cutoffHz(this.patch.filter.cutoff + this.cutoffMod * 0.4, this.patch.filter.keyTrack, vo.midi);
      vo.setCutoff(hz, q, now);
    }
  }

  setHostTempo(bpm: number | null) {
    this.hostBpm = bpm != null && bpm >= 40 && bpm <= 300 ? bpm : null;
  }

  setMaster(v: number) {
    this.patch.master = v;
    this.buses.master.gain.setTargetAtTime(clamp(v, 0, 1), this.ctx.currentTime, 0.02);
  }

  setBend(semis: number) {
    this.bend = semis;
  }

  setSustain(on: boolean) {
    this.sustain = on;
    if (!on) {
      for (const n of [...this.sustained]) {
        this.sustained.delete(n);
        if (!this.held.has(n)) this.releaseNote(n);
      }
      if (this.patch.polyMode !== "poly" && this.monoStack.length === 0) this.monoVoice?.release(this.patch);
    }
  }

  noteOn(midi: number, velocity = 0.85) {
    kickContext(this.ctx);
    if (this.patch.arp.on) {
      if (!this.arpHeld.includes(midi)) this.arpHeld.push(midi);
      this.held.set(midi, "arp");
      this.ensureArp();
      return;
    }
    const now = this.ctx.currentTime;
    if (this.patch.polyMode === "poly") {
      this.spawn(midi, velocity, now);
      return;
    }

    this.monoStack = this.monoStack.filter((n) => n !== midi);
    const overlapping = this.monoStack.length > 0 && !!this.monoVoice?.live;
    this.monoStack.push(midi);

    if (this.patch.polyMode === "legato" && overlapping && this.monoVoice) {
      this.monoVoice.glideTo(midi, this.bend, this.patch, now, true);
      this.held.set(midi, this.monoVoice);
      return;
    }

    if (this.monoVoice?.live) this.monoVoice.release(this.patch);
    this.spawn(midi, velocity, now);
  }

  noteOff(midi: number) {
    this.arpHeld = this.arpHeld.filter((n) => n !== midi);
    this.held.delete(midi);
    this.monoStack = this.monoStack.filter((n) => n !== midi);
    if (this.sustain) {
      this.sustained.add(midi);
      return;
    }
    if (this.patch.arp.on) {
      this.releaseNote(midi);
      if (this.arpHeld.length === 0) this.stopArp();
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
    this.stopArp();
    this.monoVoice = null;
    this.listener.onVoices?.(0);
  }

  resume() {
    kickContext(this.ctx);
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
    while (this.voices.length >= MAX_VOICES) {
      const oldest = this.voices[0];
      oldest?.kill();
    }
    const v = new Voice(
      this.ctx,
      this.buses.voice,
      this.lfos,
      this.patch,
      midi,
      velocity,
      this.bend,
      this.cutoffMod,
      now,
      () => {
        this.voices = this.voices.filter((x) => x !== v);
        if (this.monoVoice === v) this.monoVoice = null;
        if (this.arpVoice === v) this.arpVoice = null;
        this.listener.onVoices?.(this.voices.length);
      },
    );
    this.voices.push(v);
    this.held.set(midi, v);
    if (this.patch.polyMode !== "poly") this.monoVoice = v;
    this.listener.onVoices?.(this.voices.length);
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
    this.arpIndex = 0;
    this.listener.onArpStep?.(0, null);
  }

  private arpTick = () => {
    if (!this.patch.arp.on || this.arpHeld.length === 0) {
      this.stopArp();
      return;
    }
    const notes = this.orderArp([...this.arpHeld]);
    const oct = this.patch.arp.octaves;
    const expanded: number[] = [];
    for (let o = 0; o < oct; o++) for (const n of notes) expanded.push(n + o * 12);
    if (this.arpIndex >= expanded.length) this.arpIndex = 0;
    const note = expanded[this.arpIndex] ?? expanded[0]!;
    const now = this.ctx.currentTime;
    this.arpVoice?.release(this.patch);
    this.spawn(note, 0.85, now);
    this.arpVoice = this.voices[this.voices.length - 1] ?? null;
    this.listener.onArpStep?.(this.arpIndex, note);

    const tempo = this.hostBpm ?? this.patch.arp.tempo;
    const step = (60 / tempo) * (ARP_DIV[this.patch.arp.rate] ?? 0.25);
    const swing = this.arpIndex % 2 === 1 ? step * this.patch.arp.swing * 0.5 : 0;
    const gate = clamp(this.patch.arp.gate, 0.1, 0.95);
    window.setTimeout(() => {
      this.arpVoice?.release(this.patch);
    }, (step * gate + swing) * 1000);

    if (this.patch.arp.mode === "updown") {
      this.arpIndex += this.arpDir;
      if (this.arpIndex >= expanded.length - 1) this.arpDir = -1;
      if (this.arpIndex <= 0) this.arpDir = 1;
    } else {
      this.arpIndex = (this.arpIndex + 1) % Math.max(1, expanded.length);
    }
    this.arpTimer = window.setTimeout(this.arpTick, (step + swing) * 1000);
  };

  private orderArp(notes: number[]): number[] {
    const s = [...notes].sort((a, b) => a - b);
    switch (this.patch.arp.mode) {
      case "down":
        return s.reverse();
      case "random":
        return s.sort(() => Math.random() - 0.5);
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
