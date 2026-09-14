import type { ArpRate } from "./types";

export const DRUM_PARTS = ["kick", "snare", "ch", "oh", "clap", "ltom", "htom", "perc"] as const;
export const NOTE_TRACKS = 4;
export const BEATS_PER_BAR = 4;
export const STEPS_PER_BEAT = 4;
export const STEPS_PER_BAR = BEATS_PER_BAR * STEPS_PER_BEAT;
export const MIN_BARS = 1;
export const MAX_BARS = 8;
export type Bars = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type DrumPart = (typeof DRUM_PARTS)[number];
export type DrumKitId = "analog" | "tight" | "dust" | "industrial";
export type GrooveTarget = "a" | "b" | "ab";
export type RecMode = "off" | "live" | "wait";
export type SeqRate = ArpRate | "1/32";

/** One recorded note on a take. Time is in 16th-notes (float, unquantized). */
export type ClipNote = {
  id: string;
  note: number;
  vel: number;
  start: number;
  dur: number;
};

/** @deprecated kept so old patches migrate */
export type PhraseStep = {
  on: boolean;
  note: number;
  vel: number;
  chord: number[];
  tie: boolean;
  slide: boolean;
};

export type DrumHit = { on: boolean; vel: number };

export type Groove = {
  seqOn: boolean;
  drumsOn: boolean;
  bars: Bars;
  rate: SeqRate;
  target: GrooveTarget;
  kit: DrumKitId;
  tracks: ClipNote[][];
  trackSound: string[];
  arm: boolean[];
  mute: boolean[];
  drumArm: Record<DrumPart, boolean>;
  drumMute: Record<DrumPart, boolean>;
  drums: Record<DrumPart, DrumHit[]>;
};

export type UserSequence = {
  id: string;
  name: string;
  groove: Groove;
};

type GrooveRaw = Partial<Groove> & {
  phraseA?: PhraseStep[];
  phraseB?: PhraseStep[];
  length?: number;
  clips?: ClipNote[][];
};

export const DRUM_LABEL: Record<DrumPart, string> = {
  kick: "Kick",
  snare: "Snare",
  ch: "CH",
  oh: "OH",
  clap: "Clap",
  ltom: "Lo Tom",
  htom: "Hi Tom",
  perc: "Perc",
};

/** CK88 / GM-ish: C1 kick … F1–D2 toms */
export const DRUM_MIDI: Record<number, DrumPart> = {
  36: "kick",
  37: "perc",
  38: "snare",
  39: "clap",
  41: "ltom",
  42: "ch",
  43: "ltom",
  44: "ch",
  45: "ltom",
  46: "oh",
  47: "htom",
  48: "htom",
  49: "oh",
  50: "htom",
  56: "perc",
};

const REST = (): PhraseStep => ({ on: false, note: 48, vel: 0.85, chord: [], tie: false, slide: false });

let clipSeq = 0;
export function newClipId() {
  clipSeq += 1;
  return `n${Date.now().toString(36)}-${clipSeq.toString(36)}`;
}

export function clampBars(n: number): Bars {
  const v = Math.round(Number(n) || 1);
  return Math.max(MIN_BARS, Math.min(MAX_BARS, v)) as Bars;
}

export function stepsOf(g: Pick<Groove, "bars"> | number) {
  const bars = typeof g === "number" ? g : g.bars;
  return clampBars(bars) * STEPS_PER_BAR;
}

export function barOf(step: number) {
  return Math.floor(Math.max(0, step) / STEPS_PER_BAR) + 1;
}

export function beatOf(step: number) {
  return Math.floor((Math.max(0, step) % STEPS_PER_BAR) / STEPS_PER_BEAT) + 1;
}

/** 16th within the beat: 1–4 */
export function tickOf(step: number) {
  return (Math.max(0, step) % STEPS_PER_BEAT) + 1;
}

export function cloneClip(n: ClipNote): ClipNote {
  return { id: n.id, note: n.note, vel: n.vel, start: n.start, dur: n.dur };
}

export function cloneStep(s: PhraseStep): PhraseStep {
  return { ...s, chord: [...(s.chord ?? [])] };
}

export function emptyPhrase(n = STEPS_PER_BAR): PhraseStep[] {
  return Array.from({ length: n }, () => REST());
}

export function emptyLane(n = STEPS_PER_BAR): DrumHit[] {
  return Array.from({ length: n }, () => ({ on: false, vel: 0.85 }));
}

export function emptyClips(): ClipNote[][] {
  return Array.from({ length: NOTE_TRACKS }, () => []);
}

export function emptyTracks(): ClipNote[][] {
  return emptyClips();
}

export function defaultTrackSound(): string[] {
  return ["a", "a", "a", "a"];
}

export function defaultArm(): boolean[] {
  return [true, false, false, false];
}

export function defaultMute(): boolean[] {
  return [false, false, false, false];
}

export function defaultDrumArm(): Record<DrumPart, boolean> {
  return { kick: true, snare: true, ch: true, oh: true, clap: true, ltom: true, htom: true, perc: true };
}

export function defaultDrumMute(): Record<DrumPart, boolean> {
  return { kick: false, snare: false, ch: false, oh: false, clap: false, ltom: false, htom: false, perc: false };
}

export const SEQ_DIV: Record<string, number> = {
  "1/4": 1,
  "1/8": 0.5,
  "1/8t": 1 / 3,
  "1/16": 0.25,
  "1/16t": 1 / 6,
  "1/32": 0.125,
};

export function stepMs(tempo: number, rate: SeqRate = "1/16") {
  return (60 / Math.max(40, tempo || 120)) * (SEQ_DIV[rate] ?? 0.25) * 1000;
}

export function defaultGroove(): Groove {
  return {
    seqOn: false,
    drumsOn: false,
    bars: 1,
    rate: "1/16",
    target: "a",
    kit: "analog",
    tracks: emptyClips(),
    trackSound: defaultTrackSound(),
    arm: defaultArm(),
    mute: defaultMute(),
    drumArm: defaultDrumArm(),
    drumMute: defaultDrumMute(),
    drums: Object.fromEntries(DRUM_PARTS.map((p) => [p, emptyLane()])) as Record<DrumPart, DrumHit[]>,
  };
}

export function grooveOf(g: Groove | undefined | null): Groove {
  return g ?? defaultGroove();
}

function clampMidi(n: number) {
  return Math.max(0, Math.min(127, Math.round(n)));
}

function normChord(note: number, raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>([note]);
  const out: number[] = [];
  for (const x of raw) {
    const n = clampMidi(Number(x));
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
    if (out.length >= 7) break;
  }
  return out;
}

export function pitchesOf(st: PhraseStep): number[] {
  if (!st?.on) return [];
  return [st.note, ...(st.chord ?? []).filter((n) => n !== st.note)];
}

function mapStep(s: PhraseStep | undefined): PhraseStep {
  const note = clampMidi(s?.note ?? 48);
  const vel = s?.vel;
  return {
    on: Boolean(s?.on),
    note,
    vel: Number.isFinite(vel) ? Math.max(0, Math.min(1, vel as number)) : 0.85,
    chord: normChord(note, s?.chord),
    tie: Boolean(s?.tie),
    slide: Boolean(s?.slide),
  };
}

export function mapClip(raw: Partial<ClipNote> | undefined): ClipNote | null {
  if (!raw || typeof raw !== "object") return null;
  const note = clampMidi(Number(raw.note));
  const start = Number(raw.start);
  const dur = Number(raw.dur);
  if (!Number.isFinite(start) || !Number.isFinite(dur)) return null;
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : newClipId(),
    note,
    vel: Number.isFinite(raw.vel) ? Math.max(0, Math.min(1, Number(raw.vel))) : 0.85,
    start: Math.max(0, start),
    dur: Math.max(0.05, dur),
  };
}

/** Merge tied / rest-held steps into sustained clip notes. */
export function stepsToClips(steps: PhraseStep[]): ClipNote[] {
  const src = Array.isArray(steps) ? steps.map(mapStep) : [];
  const n = src.length;
  const used: Set<number>[] = Array.from({ length: n }, () => new Set());
  const out: ClipNote[] = [];
  for (let i = 0; i < n; i++) {
    const st = src[i]!;
    if (!st.on) continue;
    for (const note of pitchesOf(st)) {
      if (used[i]!.has(note)) continue;
      used[i]!.add(note);
      let dur = 1;
      if (st.tie) {
        for (let j = i + 1; j < n; j++) {
          const nx = src[j]!;
          if (!nx.on) {
            dur += 1;
            continue;
          }
          if (pitchesOf(nx).includes(note)) {
            used[j]!.add(note);
            dur += 1;
            if (!nx.tie) break;
            continue;
          }
          break;
        }
      }
      out.push({ id: newClipId(), note, vel: st.vel, start: i, dur });
    }
  }
  return out;
}

function looksLikeClip(x: unknown): x is ClipNote {
  return Boolean(x && typeof x === "object" && "start" in (x as object) && "note" in (x as object));
}

function looksLikeStep(x: unknown): x is PhraseStep {
  return Boolean(x && typeof x === "object" && "on" in (x as object));
}

function mapTrack(raw: unknown): ClipNote[] {
  if (!Array.isArray(raw)) return [];
  if (raw.length && looksLikeClip(raw[0])) {
    return raw.map((x) => mapClip(x as ClipNote)).filter((x): x is ClipNote => x != null);
  }
  if (raw.length && looksLikeStep(raw[0])) {
    return stepsToClips(raw as PhraseStep[]);
  }
  return [];
}

function tileLane(hits: DrumHit[], n: number): DrumHit[] {
  const src = Array.isArray(hits) && hits.length ? hits.map((h) => ({ on: Boolean(h?.on), vel: Number.isFinite(h?.vel) ? h.vel : 0.85 })) : emptyLane(STEPS_PER_BAR);
  if (src.length === n) return src;
  if (src.length > n) return src.slice(0, n);
  const out: DrumHit[] = [];
  while (out.length < n) {
    for (const h of src) {
      out.push({ ...h });
      if (out.length >= n) break;
    }
  }
  return out;
}

function mapLane(src: DrumHit[] | undefined, n: number): DrumHit[] {
  const hits = Array.isArray(src)
    ? src.map((h) => ({ on: Boolean(h?.on), vel: Number.isFinite(h?.vel) ? h.vel : 0.85 }))
    : [];
  return tileLane(hits.length ? hits : emptyLane(Math.min(n, STEPS_PER_BAR)), n);
}

export function withBars(g: Groove, bars: number): Groove {
  const next = clampBars(bars);
  const n = next * STEPS_PER_BAR;
  const drums = { ...g.drums };
  for (const part of DRUM_PARTS) drums[part] = tileLane(g.drums[part], n);
  const tracks = g.tracks.map((clips) => clips.map(cloneClip).filter((c) => c.start < n));
  return { ...g, bars: next, drums, tracks };
}

export function clearNoteTrack(g: Groove, track: number): Groove {
  const i = Math.max(0, Math.min(NOTE_TRACKS - 1, track));
  const tracks = g.tracks.map((clips, t) => (t === i ? [] : clips));
  return { ...g, tracks };
}

export function clearDrumLane(g: Groove, part: DrumPart): Groove {
  return { ...g, drums: { ...g.drums, [part]: emptyLane(stepsOf(g)) } };
}

export function appendClip(g: Groove, track: number, note: ClipNote): Groove {
  const i = Math.max(0, Math.min(NOTE_TRACKS - 1, track));
  const tracks = g.tracks.map((clips, t) => (t === i ? [...clips, note] : clips));
  return { ...g, tracks };
}

export function patchClip(g: Groove, track: number, id: string, patch: Partial<ClipNote>): Groove {
  const i = Math.max(0, Math.min(NOTE_TRACKS - 1, track));
  const tracks = g.tracks.map((clips, t) =>
    t === i ? clips.map((c) => (c.id === id ? { ...c, ...patch, id: c.id } : c)) : clips,
  );
  return { ...g, tracks };
}

export function setTrackSound(g: Groove, track: number, sound: string): Groove {
  const trackSound = padSounds(g.trackSound, g.target);
  const i = Math.max(0, Math.min(NOTE_TRACKS - 1, track));
  trackSound[i] = sound || "a";
  return { ...g, trackSound };
}

export function toggleArm(g: Groove, track: number): Groove {
  const arm = padFlags(g.arm, defaultArm());
  const i = Math.max(0, Math.min(NOTE_TRACKS - 1, track));
  arm[i] = !arm[i];
  return { ...g, arm };
}

export function toggleMute(g: Groove, track: number): Groove {
  const mute = padFlags(g.mute, defaultMute());
  const i = Math.max(0, Math.min(NOTE_TRACKS - 1, track));
  mute[i] = !mute[i];
  return { ...g, mute };
}

export function toggleDrumArm(g: Groove, part: DrumPart): Groove {
  return { ...g, drumArm: { ...g.drumArm, [part]: !g.drumArm[part] } };
}

export function toggleDrumMute(g: Groove, part: DrumPart): Groove {
  return { ...g, drumMute: { ...g.drumMute, [part]: !g.drumMute[part] } };
}

function padSounds(raw: string[] | undefined, target?: GrooveTarget): string[] {
  const fallback = target === "b" ? "b" : "a";
  const a = Array.isArray(raw) && raw.length ? raw.map((x) => (typeof x === "string" && x ? x : fallback)) : [];
  while (a.length < NOTE_TRACKS) a.push(fallback);
  return a.slice(0, NOTE_TRACKS);
}

function padFlags(raw: boolean[] | undefined, fallback: boolean[]): boolean[] {
  const a = Array.isArray(raw) ? raw.map(Boolean) : fallback.slice();
  while (a.length < NOTE_TRACKS) a.push(false);
  return a.slice(0, NOTE_TRACKS);
}

function drumFlags(raw: Partial<Record<DrumPart, boolean>> | undefined, fallback: boolean): Record<DrumPart, boolean> {
  const out = {} as Record<DrumPart, boolean>;
  for (const p of DRUM_PARTS) out[p] = typeof raw?.[p] === "boolean" ? Boolean(raw[p]) : fallback;
  return out;
}

const RATES: SeqRate[] = ["1/4", "1/8", "1/8t", "1/16", "1/16t", "1/32"];

function barsFromRaw(raw: GrooveRaw): Bars {
  if (typeof raw.bars === "number") return clampBars(raw.bars);
  if (raw.length === 32) return 2;
  if (raw.length === 8 || raw.length === 16) return 1;
  return 1;
}

export function normalizeGroove(raw: GrooveRaw | undefined): Groove {
  const d = defaultGroove();
  if (!raw || typeof raw !== "object") return d;
  const bars = barsFromRaw(raw);
  const n = bars * STEPS_PER_BAR;
  const srcTracks = Array.isArray(raw.tracks) ? raw.tracks : Array.isArray(raw.clips) ? raw.clips : [];
  const tracks = [0, 1, 2, 3].map((i) => {
    if (srcTracks[i]) return mapTrack(srcTracks[i]);
    const fallback = i === 0 ? raw.phraseA : i === 1 ? raw.phraseB : undefined;
    return fallback ? stepsToClips(fallback.map(mapStep)) : [];
  });
  return {
    seqOn: Boolean(raw.seqOn),
    drumsOn: Boolean(raw.drumsOn),
    bars,
    rate: RATES.includes(raw.rate as SeqRate) ? (raw.rate as SeqRate) : "1/16",
    target: raw.target === "b" || raw.target === "ab" ? raw.target : "a",
    kit: raw.kit === "tight" || raw.kit === "dust" || raw.kit === "industrial" ? raw.kit : "analog",
    tracks,
    trackSound: padSounds(raw.trackSound, raw.target),
    arm: padFlags(raw.arm, defaultArm()),
    mute: padFlags(raw.mute, defaultMute()),
    drumArm: drumFlags(raw.drumArm, true),
    drumMute: drumFlags(raw.drumMute, false),
    drums: Object.fromEntries(DRUM_PARTS.map((p) => [p, mapLane(raw.drums?.[p], n)])) as Record<DrumPart, DrumHit[]>,
  };
}

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function parseNote(s: string): number | null {
  const m = s.match(/^([A-G])([#b]?)(-?\d)$/i);
  if (!m) return null;
  let pc = PC[m[1]!.toUpperCase()] ?? 0;
  if (m[2] === "#") pc += 1;
  if (m[2] === "b") pc -= 1;
  const oct = Number(m[3]);
  return Math.max(0, Math.min(127, (oct + 1) * 12 + pc));
}

export function noteName(midi: number) {
  const n = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const m = Math.max(0, Math.min(127, Math.round(midi)));
  return `${n[m % 12]}${Math.floor(m / 12) - 1}`;
}

function parseToken(t: string): PhraseStep | null {
  if (!t || t === "." || t === "-") return null;
  let s = t;
  const slide = s.endsWith("/");
  const tie = s.endsWith("~");
  const acc = s.endsWith("*");
  s = s.replace(/[/*~]$/, "");
  const notes = s
    .split("+")
    .map((p) => parseNote(p))
    .filter((n): n is number => n != null);
  if (!notes.length) return null;
  return { on: true, note: notes[0]!, vel: acc ? 1 : 0.82, chord: notes.slice(1), tie, slide };
}

/** Tokens: `.` rest, `C2` note, `C2+E2+G2` chord, `C2*` accent, `C2~` tie, `C2/` slide. */
export function parsePhrase(code: string): PhraseStep[] {
  const tokens = code.trim().split(/\s+/).filter(Boolean);
  const out = emptyPhrase(Math.max(STEPS_PER_BAR, tokens.length || STEPS_PER_BAR));
  if (!tokens.length) return out.slice(0, STEPS_PER_BAR);
  const n = tokens.length;
  const len = n <= 16 ? 16 : 32;
  const phrase = emptyPhrase(len);
  for (let i = 0; i < len; i++) {
    const st = parseToken(tokens[i % n]!);
    if (st) phrase[i] = st;
  }
  return phrase;
}

export function parsePhraseClips(code: string): ClipNote[] {
  return stepsToClips(parsePhrase(code));
}

export function parseLane(code: string): DrumHit[] {
  const raw = code.replace(/\s/g, "");
  const len = raw.length <= 16 ? 16 : 32;
  const out = emptyLane(len);
  if (!raw.length) return out;
  const n = raw.length;
  for (let i = 0; i < len; i++) {
    const c = raw[i % n];
    if (c === "x") out[i] = { on: true, vel: 0.8 };
    else if (c === "X") out[i] = { on: true, vel: 1 };
  }
  return out;
}

export function snapshotGroove(g: Groove): Groove {
  return normalizeGroove(JSON.parse(JSON.stringify(g)) as Groove);
}
