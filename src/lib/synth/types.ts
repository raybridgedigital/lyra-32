import type { ArpStep } from "./arp";
import type { Groove } from "./groove";

export type Waveform =
  | "sine"
  | "triangle"
  | "sawtooth"
  | "square"
  | "pulse"
  | "supersaw"
  | "wt";

export type FilterType = "lowpass" | "highpass" | "bandpass" | "notch";
export type FilterSlope = 12 | 24;
export type LfoDest = "cutoff" | "pitch" | "pan" | "amp" | "res" | "fm";
export type LfoWave = "sine" | "triangle" | "sawtooth" | "square";
export type PolyMode = "poly" | "mono" | "legato";
export type ArpMode = "up" | "down" | "updown" | "random" | "asplayed";
export type ArpRate = "1/4" | "1/8" | "1/8t" | "1/16" | "1/16t";
export type ModSource = "lfo1" | "lfo2" | "fenv" | "vel" | "mod" | "at";
export type ModDest = LfoDest;

export type OscParams = {
  wave: Waveform;
  octave: number;
  semitone: number;
  fine: number;
  level: number;
  pwm: number;
};

export type LfoParams = { rate: number; depth: number; dest: LfoDest; wave: LfoWave };

export type ModRoute = { src: ModSource; dest: ModDest; amount: number };

export type ArpParams = {
  on: boolean;
  hold: boolean;
  pattern: boolean;
  mode: ArpMode;
  rate: ArpRate;
  octaves: 1 | 2 | 3;
  gate: number;
  swing: number;
  tempo: number;
  steps: ArpStep[];
};

export type Patch = {
  id: string;
  name: string;
  category: string;
  osc1: OscParams;
  osc2: OscParams;
  subLevel: number;
  noiseLevel: number;
  fmIndex: number;
  ring: number;
  sync: number;
  drift: number;
  velFilt: number;
  drive: number;
  filter: {
    type: FilterType;
    slope: FilterSlope;
    cutoff: number;
    resonance: number;
    envAmount: number;
    keyTrack: number;
  };
  ampEnv: { attack: number; decay: number; sustain: number; release: number };
  filterEnv: { attack: number; decay: number; sustain: number; release: number };
  lfo: LfoParams;
  lfo2: LfoParams;
  matrix: ModRoute[];
  fx: {
    delayMix: number;
    delayTime: number;
    delayFeedback: number;
    reverbMix: number;
    chorusMix: number;
    phaserMix: number;
  };
  unison: { voices: 1 | 2 | 3; detune: number; spread: number };
  glide: number;
  polyMode: PolyMode;
  master: number;
  arp: ArpParams;
  groove?: Groove;
  stack?: PatchStack;
};

export type MidiStatus = "idle" | "ok" | "denied" | "unsupported" | "none";

export type LayerId = "a" | "b";
export type StackMode = "stack" | "split";

export type LayerMix = {
  on: boolean;
  level: number;
  pan: number;
};

export type PatchStack = {
  mode: StackMode;
  splitNote: number;
  a: LayerMix;
  b: LayerMix & { patch: Patch };
};
