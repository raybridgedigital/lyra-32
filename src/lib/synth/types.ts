export type Waveform =
  | "sine"
  | "triangle"
  | "sawtooth"
  | "square"
  | "pulse"
  | "supersaw";

export type FilterType = "lowpass" | "highpass" | "bandpass";
export type FilterSlope = 12 | 24;
export type LfoDest = "cutoff" | "pitch";
export type LfoWave = "sine" | "triangle" | "sawtooth" | "square";
export type PolyMode = "poly" | "mono" | "legato";
export type ArpMode = "up" | "down" | "updown" | "random" | "asplayed";
export type ArpRate = "1/4" | "1/8" | "1/8t" | "1/16" | "1/16t";

export type OscParams = {
  wave: Waveform;
  octave: number;
  semitone: number;
  fine: number;
  level: number;
  pwm: number;
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
  lfo: { rate: number; depth: number; dest: LfoDest; wave: LfoWave };
  fx: {
    delayMix: number;
    delayTime: number;
    delayFeedback: number;
    reverbMix: number;
    chorusMix: number;
  };
  unison: { voices: 1 | 2 | 3; detune: number; spread: number };
  glide: number;
  polyMode: PolyMode;
  master: number;
  arp: {
    on: boolean;
    mode: ArpMode;
    rate: ArpRate;
    octaves: 1 | 2 | 3;
    gate: number;
    swing: number;
    tempo: number;
  };
};

export type MidiStatus = "idle" | "ok" | "denied" | "unsupported" | "none";
