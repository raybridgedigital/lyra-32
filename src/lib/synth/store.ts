import { create } from "zustand";
import type { LayerId, LayerMix, MidiStatus, Patch, StackMode } from "./types";
import { FACTORY, INIT_PATCH, clonePatch } from "./patches";
import { LyraEngine, createEngine } from "./engine";
import { QWERTY_MAP, connectMidi, setMidiPortFilter, type MidiPortInfo } from "./midi";
import { defaultMix } from "./stack";
import { DRUM_MIDI, clearDrumLane as wipeDrumLane, clearNoteTrack as wipeNoteTrack, grooveOf, newClipId, normalizeGroove, patchClip, snapshotGroove, stepsOf, type DrumPart, type Groove, type RecMode, type UserSequence } from "./groove";
import { applyBeat, applyGroovePreset, applyPhrase } from "./groove-factory";
import { applyLearnCc, loadMidiMap, saveMidiMap } from "./midi-learn";
import { captureScene, emptyScenes, loadScenes, saveScenes, type Scene, type SceneSlot } from "./scenes";
import { morphScene } from "./morph";
import { downloadBlob } from "./wav-bounce";
import { applyBackup, collectBackup } from "./backup";

const USER_KEY = "lyra32-user-patches";
const SEQ_KEY = "lyra32-user-sequences";
const KEYS_KEY = "lyra32-show-keys";
const PORT_KEY = "lyra32-midi-port";
const CLOCK_KEY = "lyra32-clock-follow";
const SINK_KEY = "lyra32-audio-sink";
const IOS_LOW_KEY = "lyra32-ios-lowlat";
const FAV_KEY = "lyra32-favorites";

function loadUser(): Patch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Patch[];
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((p) => {
      try {
        return [clonePatch(p)];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

function saveUser(patches: Patch[]) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(patches));
  } catch {
    /* quota */
  }
}

function loadFavs(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAV_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveFavs(ids: string[]) {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(ids));
  } catch {
    /* quota */
  }
}

function loadSeqs(): UserSequence[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SEQ_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x === "object" && typeof (x as UserSequence).id === "string")
      .map((x) => {
        const s = x as UserSequence;
        return { id: s.id, name: String(s.name || "Sequence"), groove: normalizeGroove(s.groove) };
      });
  } catch {
    return [];
  }
}

function saveSeqs(list: UserSequence[]) {
  try {
    localStorage.setItem(SEQ_KEY, JSON.stringify(list));
  } catch {
    /* quota */
  }
}

type State = {
  patch: Patch;
  layer: LayerId;
  layerA: Patch;
  layerB: Patch;
  mixA: LayerMix;
  mixB: LayerMix;
  stackMode: StackMode;
  splitNote: number;
  factory: Patch[];
  userPatches: Patch[];
  userSequences: UserSequence[];
  favorites: string[];
  armed: boolean;
  ctxState: AudioContextState | "none";
  midiStatus: MidiStatus;
  midiName: string | null;
  midiPorts: MidiPortInfo[];
  midiPortId: string;
  audioOutputs: { id: string; label: string }[];
  audioOutputId: string;
  audioSinkOk: boolean;
  audioPickOk: boolean;
  audioSinkMsg: string;
  iosLowLat: boolean;
  clockBpm: number | null;
  clockRunning: boolean;
  clockFollow: boolean;
  dawOpen: boolean;
  helpOpen: boolean;
  stageLock: boolean;
  midiLearn: boolean;
  midiLearnId: string | null;
  midiMap: Record<number, string>;
  scenes: SceneSlot[];
  activeScene: number | null;
  abSnap: Scene | null;
  abOn: boolean;
  morphFrom: number;
  morphTo: number;
  morphAmt: number;
  clickOn: boolean;
  countIn: boolean;
  bounceOn: boolean;
  countingIn: boolean;
  voices: number;
  cutoffMod: number;
  octave: number;
  transpose: number;
  activeNotes: number[];
  arpStep: number;
  grooveStep: number;
  groovePlaying: boolean;
  recMode: RecMode;
  recStep: number;
  grooveUndo: Groove[];
  grooveRedo: Groove[];
  masterMute: boolean;
  showKeys: boolean;
  engine: LyraEngine | null;
  arm: () => void;
  loadPatch: (p: Patch) => void;
  setPatch: (p: Patch) => void;
  saveUserPatch: (name: string) => void;
  renameUserPatch: (id: string, name: string) => void;
  deleteUserPatch: (id: string) => void;
  toggleFavorite: (id: string) => void;
  saveUserSequence: (name: string) => void;
  renameUserSequence: (id: string, name: string) => void;
  deleteUserSequence: (id: string) => void;
  loadUserSequence: (id: string) => void;
  noteOn: (midi: number, vel?: number) => void;
  noteOff: (midi: number) => void;
  shiftOctave: (d: number) => void;
  shiftTranspose: (d: number) => void;
  panic: () => void;
  toggleMute: () => void;
  toggleKeys: () => void;
  setMidiPort: (id: string) => void;
  refreshAudioOutputs: () => Promise<void>;
  setAudioOutput: (id: string) => Promise<void>;
  pickAudioOutput: () => Promise<void>;
  setIosLowLat: (on: boolean) => void;
  setClockFollow: (on: boolean) => void;
  setDawOpen: (on: boolean) => void;
  setHelpOpen: (on: boolean) => void;
  setStageLock: (on: boolean) => void;
  setMidiLearn: (on: boolean) => void;
  armLearn: (id: string) => void;
  saveScene: (i: number) => void;
  recallScene: (i: number) => void;
  clearScene: (i: number) => void;
  renameScene: (i: number, name: string) => void;
  storeAb: () => void;
  toggleAb: () => void;
  setMorph: (from: number, to: number, amt: number) => void;
  setClickOn: (on: boolean) => void;
  setCountIn: (on: boolean) => void;
  toggleBounce: () => void;
  selectLayer: (id: LayerId) => void;
  setLayerOn: (id: LayerId, on: boolean) => void;
  setLayerLevel: (id: LayerId, level: number) => void;
  setLayerPan: (id: LayerId, pan: number) => void;
  setStackMode: (mode: StackMode) => void;
  setSplitNote: (note: number) => void;
  setGroove: (g: Groove) => void;
  setGroovePlaying: (on: boolean) => void;
  setRecMode: (mode: RecMode) => void;
  undoGroove: () => void;
  redoGroove: () => void;
  loadPhrase: (id: string) => void;
  loadBeat: (id: string) => void;
  loadGroovePreset: (id: string) => void;
  hitDrum: (part: DrumPart, vel?: number) => void;
  clearNoteTrack: (track: number) => void;
  clearDrumLane: (part: DrumPart) => void;
  hydrate: () => void;
  exportBackup: () => void;
  importBackup: (raw: unknown) => boolean;
};

function emptyScenesSafe(): SceneSlot[] {
  return typeof window === "undefined" ? emptyScenes() : loadScenes();
}

function applyLive(
  get: () => State,
  set: (p: Partial<State>) => void,
  sc: Scene,
) {
  set({
    layer: "a",
    patch: sc.layerA,
    layerA: sc.layerA,
    layerB: sc.layerB,
    mixA: sc.mixA,
    mixB: sc.mixB,
    stackMode: sc.stackMode,
    splitNote: sc.splitNote,
  });
  putGroove(get, set, sc.groove, false);
  pushEngine(get);
}

function shareFx(from: Patch, onto: Patch): Patch {
  return clonePatch(onto, { fx: from.fx, arp: from.arp, master: from.master, groove: from.groove });
}

function putGroove(get: () => State, set: (p: Partial<State>) => void, groove: Groove, snap = false) {
  if (snap) pushUndo(get, set);
  const s = get();
  const patch = clonePatch(s.patch, { groove });
  if (s.layer === "b") set({ patch, layerB: patch, layerA: shareFx(patch, s.layerA) });
  else set({ patch, layerA: patch, layerB: shareFx(patch, s.layerB) });
  pushEngine(get);
}

function pushEngine(get: () => State) {
  const s = get();
  s.engine?.setStack({
    mode: s.stackMode,
    splitNote: s.splitNote,
    a: { id: "a", on: s.mixA.on, level: s.mixA.level, pan: s.mixA.pan, patch: s.layerA },
    b: { id: "b", on: s.mixB.on, level: s.mixB.level, pan: s.mixB.pan, patch: s.layerB },
  });
  s.engine?.applyPatch(s.patch);
  s.engine?.setBank?.([...s.factory, ...s.userPatches]);
}
let midiUnsub: (() => void) | null = null;
let midiQueued = false;
const heldKeys = new Map<string, number>();
const soundingByInput = new Map<number, number>();
const recOpen = new Map<string, { track: number; id: string; start: number }>();
let recDidSnap = false;
const UNDO_MAX = 24;

function pushUndo(get: () => State, set: (p: Partial<State>) => void) {
  const cur = snapshotGroove(grooveOf(get().patch.groove));
  const grooveUndo = [...get().grooveUndo, cur].slice(-UNDO_MAX);
  set({ grooveUndo, grooveRedo: [] });
}

function recSnap(get: () => State, set: (p: Partial<State>) => void) {
  if (recDidSnap) return;
  pushUndo(get, set);
  recDidSnap = true;
}

function recPos(): number {
  const s = useSynth.getState();
  if (s.engine && s.groovePlaying) return s.engine.groovePos();
  return Math.max(0, s.grooveStep);
}

function recIndex(): number {
  const s = useSynth.getState();
  const g = grooveOf(s.patch.groove);
  const len = Math.max(1, stepsOf(g));
  const i = s.groovePlaying ? Math.floor(recPos()) : Math.max(0, s.grooveStep);
  return ((i % len) + len) % len;
}

function blocksComputerKeys(t: EventTarget | null) {
  if (!t || !(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (t as HTMLInputElement).type;
    return type !== "range" && type !== "button" && type !== "checkbox";
  }
  return false;
}

function hookMidi(engine: LyraEngine) {
  if (midiQueued) return;
  midiQueued = true;
  window.setTimeout(() => {
    setMidiPortFilter(useSynth.getState().midiPortId);
    void connectMidi({
      noteOn: (n, v) => useSynth.getState().noteOn(n, v),
      noteOff: (n) => useSynth.getState().noteOff(n),
      cc: (ctl, value) => {
        if (ctl === 64) {
          engine.setSustain(value >= 0.5);
          return;
        }
        const st = useSynth.getState();
        if (st.midiLearn && st.midiLearnId) {
          const midiMap = { ...st.midiMap, [ctl]: st.midiLearnId };
          saveMidiMap(midiMap);
          useSynth.setState({ midiMap, midiLearnId: null });
          return;
        }
        const learned = st.midiMap[ctl];
        if (learned) {
          st.setPatch(applyLearnCc(st.patch, learned, value));
          return;
        }
        if (ctl === 1 || ctl === 74) {
          engine.setCutoffMod(value);
          useSynth.setState({ cutoffMod: value });
        }
        if (ctl === 7) {
          const p = clonePatch(useSynth.getState().patch, { master: value });
          useSynth.getState().setPatch(p);
        }
      },
      pitchBend: (semis) => engine.setBend(semis),
      aftertouch: (v) => engine.setAftertouch(v),
      onStatus: (status, name) => useSynth.setState({ midiStatus: status, midiName: name }),
      onPorts: (ports) => useSynth.setState({ midiPorts: ports }),
      onClock: ({ bpm, running }) => {
        const s = useSynth.getState();
        const rounded = bpm != null ? Math.round(bpm) : null;
        if (s.clockBpm === rounded && s.clockRunning === running) return;
        useSynth.setState({ clockBpm: rounded, clockRunning: running });
        if (s.clockFollow) s.engine?.setHostTempo(running ? rounded : null);
      },
    }).then((unsub) => {
      midiUnsub = unsub;
    });
  }, 350);
}

let htmlKeep: HTMLAudioElement | null = null;

function isTouchIos() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function unlockHtml() {
  try {
    if (!isTouchIos()) {
      const a = new Audio(
        "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA",
      );
      a.volume = 0.01;
      void a.play();
      return;
    }
    if (!htmlKeep) {
      const a = new Audio(
        "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA",
      );
      a.loop = true;
      a.volume = 0.001;
      a.setAttribute("playsinline", "true");
      a.setAttribute("webkit-playsinline", "true");
      htmlKeep = a;
    }
    void htmlKeep.play();
    if (navigator.mediaSession) {
      navigator.mediaSession.playbackState = "playing";
      navigator.mediaSession.metadata = new MediaMetadata({ title: "LYRA-32", artist: "Ray Bridge Digital" });
    }
  } catch {
    /* */
  }
}

function bootEngine(): LyraEngine {
  const existing = useSynth.getState().engine;
  if (existing) {
    existing.resume();
    unlockHtml();
    return existing;
  }
  unlockHtml();
  const engine = createEngine({
    onVoices: (n) => useSynth.setState({ voices: n }),
    onArpStep: (step) => useSynth.setState({ arpStep: step }),
    onGrooveStep: (step) => useSynth.setState({ grooveStep: step }),
    onState: (ctxState) => useSynth.setState({ ctxState, armed: ctxState === "running" || useSynth.getState().armed }),
  });
  engine.applyPatch(useSynth.getState().patch);
  useSynth.setState({ engine, armed: true, ctxState: engine.ctx.state, audioSinkOk: engine.canSetSink() });
  const sink = useSynth.getState().audioOutputId;
  if (sink && !isTouchIos()) void engine.setSink(sink).catch(() => { /* */ });
  if (useSynth.getState().iosLowLat) engine.setIosLowLat(true);
  pushEngine(() => useSynth.getState());
  hookMidi(engine);

  const onVis = () => {
    if (document.visibilityState === "visible") engine.resume();
  };
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("focus", () => engine.resume());
  return engine;
}

export const useSynth = create<State>((set, get) => ({
  patch: clonePatch(INIT_PATCH),
  layer: "a" as LayerId,
  layerA: clonePatch(INIT_PATCH),
  layerB: clonePatch(INIT_PATCH),
  mixA: defaultMix(true),
  mixB: { on: false, level: 0.7, pan: 0.15 },
  stackMode: "stack" as StackMode,
  splitNote: 60,
  factory: FACTORY,
  userPatches: loadUser(),
  userSequences: loadSeqs(),
  favorites: loadFavs(),
  armed: false,
  ctxState: "none",
  midiStatus: "idle",
  midiName: null,
  midiPorts: [],
  midiPortId: "all",
  audioOutputs: [],
  audioOutputId: typeof window === "undefined" ? "" : localStorage.getItem(SINK_KEY) || "",
  audioSinkOk: false,
  audioPickOk: false,
  audioSinkMsg: "",
  iosLowLat: typeof window === "undefined" ? false : localStorage.getItem(IOS_LOW_KEY) === "1",
  clockBpm: null,
  clockRunning: false,
  clockFollow: false,
  dawOpen: false,
  helpOpen: false,
  stageLock: false,
  midiLearn: false,
  midiLearnId: null,
  midiMap: typeof window === "undefined" ? {} : loadMidiMap(),
  scenes: emptyScenesSafe(),
  activeScene: null,
  abSnap: null,
  abOn: false,
  morphFrom: 0,
  morphTo: 1,
  morphAmt: 0,
  clickOn: false,
  countIn: false,
  bounceOn: false,
  countingIn: false,
  voices: 0,
  cutoffMod: 0,
  octave: 0,
  transpose: 0,
  activeNotes: [],
  arpStep: -1,
  grooveStep: -1,
  groovePlaying: false,
  recMode: "off",
  recStep: 0,
  grooveUndo: [],
  grooveRedo: [],
  masterMute: false,
  showKeys: typeof window === "undefined" ? true : localStorage.getItem(KEYS_KEY) !== "0",
  engine: null,

  arm: () => {
    bootEngine();
  },

  loadPatch: (p) => {
    const stacked = p.stack?.b?.patch;
    if (stacked) {
      const a = clonePatch({ ...p, stack: undefined });
      const b = shareFx(a, clonePatch({ ...stacked, stack: undefined }));
      set({
        layer: "a",
        patch: a,
        layerA: a,
        layerB: b,
        mixA: { on: p.stack!.a.on, level: p.stack!.a.level, pan: p.stack!.a.pan },
        mixB: { on: p.stack!.b.on, level: p.stack!.b.level, pan: p.stack!.b.pan },
        stackMode: p.stack!.mode,
        splitNote: p.stack!.splitNote,
      });
    } else {
      const next = clonePatch({ ...p, stack: undefined });
      const s = get();
      if (s.layer === "b") {
        const layerB = shareFx(s.layerA, next);
        set({ patch: layerB, layerB, mixB: { ...s.mixB, on: true } });
      } else {
        const layerA = next;
        set({ patch: layerA, layerA, layerB: shareFx(layerA, s.layerB) });
      }
    }
    pushEngine(get);
  },

  setPatch: (p) => {
    const s = get();
    if (s.layer === "b") {
      const layerB = p;
      const layerA = shareFx(p, s.layerA);
      set({ patch: layerB, layerB, layerA });
    } else {
      const layerA = p;
      const layerB = shareFx(p, s.layerB);
      set({ patch: layerA, layerA, layerB });
    }
    pushEngine(get);
  },

  saveUserPatch: (name) => {
    const s = get();
    const id = `user-${Date.now()}`;
    const label = name.trim() || "User patch";
    let p = clonePatch(s.layerA, { id, name: label, category: "User", stack: undefined });
    if (s.mixB.on) {
      p = clonePatch(p, {
        stack: {
          mode: s.stackMode,
          splitNote: s.splitNote,
          a: s.mixA,
          b: { ...s.mixB, patch: clonePatch({ ...s.layerB, stack: undefined }) },
        },
      });
    }
    const userPatches = [...s.userPatches, p];
    saveUser(userPatches);
    set({ userPatches, patch: s.layer === "a" ? p : s.patch, layerA: s.layer === "a" ? p : s.layerA });
  },

  renameUserPatch: (id, name) => {
    const next = name.trim();
    if (!next) return;
    const userPatches = get().userPatches.map((p) => (p.id === id ? clonePatch(p, { name: next }) : p));
    saveUser(userPatches);
    const patch = get().patch.id === id ? clonePatch(get().patch, { name: next }) : get().patch;
    set({ userPatches, patch });
  },

  deleteUserPatch: (id) => {
    const userPatches = get().userPatches.filter((p) => p.id !== id);
    const favorites = get().favorites.filter((x) => x !== id);
    saveUser(userPatches);
    saveFavs(favorites);
    set({ userPatches, favorites });
  },

  toggleFavorite: (id) => {
    const cur = get().favorites;
    const favorites = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    saveFavs(favorites);
    set({ favorites });
  },

  noteOn: (midi, vel = 0.85) => {
    const engine = bootEngine();
    const s0 = get();
    const sounded = clampInt(midi + s0.octave * 12 + s0.transpose, 0, 127);
    const rec = s0.recMode;
    const g = grooveOf(s0.patch.groove);
    const mapped = DRUM_MIDI[midi];
    const drumPart = rec !== "off" && g.drumsOn && mapped && g.drumArm[mapped] ? mapped : undefined;

    if (rec !== "off" && (g.seqOn || g.drumsOn)) {
      if (rec === "wait") {
        engine.setGroovePlaying(true);
        set({ groovePlaying: true, recMode: "live" });
      }
      recSnap(get, set);
      if (drumPart) {
        const groove = snapshotGroove(grooveOf(get().patch.groove));
        const idx = recIndex();
        const lane = groove.drums[drumPart].slice();
        lane[idx] = { on: true, vel };
        groove.drums = { ...groove.drums, [drumPart]: lane };
        engine.hitDrum(drumPart, vel);
        putGroove(get, set, groove);
      } else if (g.seqOn) {
        const pos = recPos();
        const groove = snapshotGroove(grooveOf(get().patch.groove));
        groove.tracks = groove.tracks.map((clips, t) => {
          if (!groove.arm[t]) return clips;
          const id = newClipId();
          recOpen.set(`${t}:${sounded}`, { track: t, id, start: pos });
          return [...clips, { id, note: sounded, vel, start: pos, dur: 0.25 }];
        });
        putGroove(get, set, groove);
      }
    }

    if (!drumPart) {
      soundingByInput.set(midi, sounded);
      try {
        engine.noteOn(sounded, vel);
      } catch (err) {
        console.error("lyra noteOn", err);
      }
      const { activeNotes } = get();
      if (!activeNotes.includes(sounded)) set({ activeNotes: [...activeNotes, sounded] });
    }
  },

  noteOff: (midi) => {
    const had = soundingByInput.has(midi);
    const sounded = soundingByInput.get(midi) ?? clampInt(midi + get().octave * 12 + get().transpose, 0, 127);
    soundingByInput.delete(midi);
    const s = get();
    const g = grooveOf(s.patch.groove);
    if (had && s.recMode !== "off" && g.seqOn) {
      const pos = recPos();
      const len = Math.max(1, stepsOf(g));
      let groove = snapshotGroove(g);
      let changed = false;
      for (let t = 0; t < 4; t++) {
        const open = recOpen.get(`${t}:${sounded}`);
        if (!open) continue;
        recOpen.delete(`${t}:${sounded}`);
        let dur = pos - open.start;
        if (dur < 0) dur += len;
        groove = patchClip(groove, t, open.id, { dur: Math.max(0.08, dur) });
        changed = true;
      }
      if (changed) putGroove(get, set, groove);
    }
    get().engine?.noteOff(sounded);
    set({ activeNotes: s.activeNotes.filter((n) => n !== sounded) });
  },

  shiftOctave: (d) => set({ octave: clampInt(get().octave + d, -3, 4) }),
  shiftTranspose: (d) => set({ transpose: clampInt(get().transpose + d, -24, 24) }),

  panic: () => {
    get().engine?.panic();
    soundingByInput.clear();
    recOpen.clear();
    set({ activeNotes: [], groovePlaying: false, recMode: "off", grooveStep: -1, cutoffMod: 0 });
  },

  toggleMute: () => {
    const next = !get().masterMute;
    set({ masterMute: next });
    get().engine?.setMuted(next);
  },

  toggleKeys: () => {
    const next = !get().showKeys;
    try {
      localStorage.setItem(KEYS_KEY, next ? "1" : "0");
    } catch {
      /* */
    }
    set({ showKeys: next });
  },

  setMidiPort: (id) => {
    const midiPortId = id || "all";
    try {
      localStorage.setItem(PORT_KEY, midiPortId);
    } catch {
      /* */
    }
    setMidiPortFilter(midiPortId);
    set({ midiPortId });
  },

  refreshAudioOutputs: async () => {
    const pick = typeof (navigator.mediaDevices as MediaDevices & { selectAudioOutput?: unknown })?.selectAudioOutput === "function";
    const engine = get().engine;
    const ok = engine?.canSetSink() ?? typeof (AudioContext.prototype as { setSinkId?: unknown }).setSinkId === "function";
    let audioOutputs: { id: string; label: string }[] = [];
    try {
      const all = (await navigator.mediaDevices?.enumerateDevices()) ?? [];
      audioOutputs = all
        .filter((d) => d.kind === "audiooutput")
        .map((d, i) => ({
          id: d.deviceId,
          label: d.label || (d.deviceId === "default" || !d.deviceId ? "System default" : `Output ${i + 1}`),
        }));
    } catch {
      /* */
    }
    set({
      audioOutputs,
      audioSinkOk: ok,
      audioPickOk: pick,
      audioSinkMsg: pick
        ? get().audioSinkMsg
        : "This tab cannot list speakers. LYRA follows  → System Settings → Sound (MacBook Speakers or CK Series).",
    });
  },

  setAudioOutput: async (id) => {
    const engine = bootEngine();
    try {
      localStorage.setItem(SINK_KEY, id);
    } catch {
      /* */
    }
    set({ audioOutputId: id });
    try {
      await engine.setSink(id);
    } catch (e) {
      set({ audioSinkMsg: e instanceof Error ? e.message : "Could not switch speaker." });
    }
    await get().refreshAudioOutputs();
  },

  setIosLowLat: (on) => {
    try {
      localStorage.setItem(IOS_LOW_KEY, on ? "1" : "0");
    } catch {
      /* */
    }
    set({ iosLowLat: on });
    get().engine?.setIosLowLat(on);
  },

  pickAudioOutput: async () => {
    const md = navigator.mediaDevices as MediaDevices & {
      selectAudioOutput?: () => Promise<{ deviceId: string; label: string }>;
    };
    if (typeof md.selectAudioOutput !== "function") {
      set({
        audioPickOk: false,
        audioSinkMsg:
          "This tab cannot list speakers (Chrome hid the picker). Use  → System Settings → Sound — MacBook Speakers or CK Series. LYRA already follows that.",
      });
      return;
    }
    set({ audioSinkMsg: "Waiting for Chrome’s speaker list…" });
    try {
      const info = await md.selectAudioOutput();
      bootEngine();
      await get().setAudioOutput(info.deviceId);
      set({ audioSinkMsg: info.label ? `Output: ${info.label}` : "Output set." });
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      if (name === "AbortError" || name === "NotFoundError") {
        set({ audioSinkMsg: "No speaker picked." });
      } else {
        set({
          audioSinkMsg:
            "Chrome blocked the speaker list. Use  → System Settings → Sound, or allow Speakers in the address-bar padlock.",
        });
      }
    }
  },

  setClockFollow: (on) => {
    try {
      localStorage.setItem(CLOCK_KEY, on ? "1" : "0");
    } catch {
      /* */
    }
    set({ clockFollow: on });
    const s = get();
    s.engine?.setHostTempo(on ? s.clockBpm : null);
  },

  setDawOpen: (on) => {
    set({ dawOpen: on, helpOpen: on ? false : get().helpOpen });
    if (on) void get().refreshAudioOutputs();
  },
  setHelpOpen: (on) => set({ helpOpen: on, dawOpen: on ? false : get().dawOpen }),
  setStageLock: (on) => {
    set({ stageLock: on });
    if (on) get().arm();
  },

  setMidiLearn: (on) => set({ midiLearn: on, midiLearnId: on ? get().midiLearnId : null }),
  armLearn: (id) => set({ midiLearn: true, midiLearnId: id }),

  saveScene: (i) => {
    const s = get();
    const slots = s.scenes.slice();
    const prev = slots[i];
    slots[i] = {
      ...captureScene({
        layerA: s.layerA,
        layerB: s.layerB,
        mixA: s.mixA,
        mixB: s.mixB,
        stackMode: s.stackMode,
        splitNote: s.splitNote,
        groove: grooveOf(s.patch.groove),
      }),
      name: prev?.name ?? `S${i + 1}`,
    };
    saveScenes(slots);
    set({ scenes: slots, activeScene: i });
  },
  recallScene: (i) => {
    const sc = get().scenes[i];
    if (!sc) return;
    applyLive(get, set, sc);
    set({ activeScene: i, abOn: false });
  },
  clearScene: (i) => {
    const slots = get().scenes.slice();
    slots[i] = null;
    saveScenes(slots);
    set({ scenes: slots, activeScene: get().activeScene === i ? null : get().activeScene });
  },
  renameScene: (i, name) => {
    const slots = get().scenes.slice();
    if (!slots[i]) return;
    slots[i] = { ...slots[i]!, name: name.trim().slice(0, 16) };
    saveScenes(slots);
    set({ scenes: slots });
  },
  storeAb: () => {
    const s = get();
    set({
      abSnap: captureScene({
        layerA: s.layerA,
        layerB: s.layerB,
        mixA: s.mixA,
        mixB: s.mixB,
        stackMode: s.stackMode,
        splitNote: s.splitNote,
        groove: grooveOf(s.patch.groove),
      }),
      abOn: false,
    });
  },
  toggleAb: () => {
    const s = get();
    if (!s.abSnap) {
      get().storeAb();
      return;
    }
    if (!s.abOn) {
      const live = captureScene({
        layerA: s.layerA,
        layerB: s.layerB,
        mixA: s.mixA,
        mixB: s.mixB,
        stackMode: s.stackMode,
        splitNote: s.splitNote,
        groove: grooveOf(s.patch.groove),
      });
      applyLive(get, set, s.abSnap);
      set({ abOn: true, abSnap: live });
    } else {
      applyLive(get, set, s.abSnap);
      set({ abOn: false, abSnap: captureScene({
        layerA: get().layerA,
        layerB: get().layerB,
        mixA: get().mixA,
        mixB: get().mixB,
        stackMode: get().stackMode,
        splitNote: get().splitNote,
        groove: grooveOf(get().patch.groove),
      }) });
    }
  },
  setMorph: (from, to, amt) => {
    const s = get();
    const a = s.scenes[from];
    const b = s.scenes[to];
    set({ morphFrom: from, morphTo: to, morphAmt: amt });
    if (!a || !b || from === to) return;
    applyLive(get, set, morphScene(a, b, amt));
  },
  setClickOn: (on) => {
    set({ clickOn: on });
    get().engine?.setClickOn(on);
  },
  setCountIn: (on) => set({ countIn: on }),
  toggleBounce: () => {
    const engine = bootEngine();
    const s = get();
    if (!s.bounceOn) {
      engine.startBounce();
      set({ bounceOn: true });
      return;
    }
    const blob = engine.stopBounce();
    set({ bounceOn: false });
    if (blob) {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      downloadBlob(blob, `lyra-${stamp}.wav`);
    }
  },

  selectLayer: (id) => {
    const s = get();
    const patch = id === "b" ? s.layerB : s.layerA;
    set({ layer: id, patch });
    s.engine?.applyPatch(patch);
  },

  setLayerOn: (id, on) => {
    if (id === "a") set({ mixA: { ...get().mixA, on } });
    else set({ mixB: { ...get().mixB, on } });
    pushEngine(get);
  },

  setLayerLevel: (id, level) => {
    if (id === "a") set({ mixA: { ...get().mixA, level } });
    else set({ mixB: { ...get().mixB, level } });
    pushEngine(get);
  },

  setLayerPan: (id, pan) => {
    if (id === "a") set({ mixA: { ...get().mixA, pan } });
    else set({ mixB: { ...get().mixB, pan } });
    pushEngine(get);
  },

  setStackMode: (mode) => {
    set({ stackMode: mode });
    pushEngine(get);
  },

  setSplitNote: (note) => {
    set({ splitNote: Math.max(24, Math.min(96, Math.round(note))) });
    pushEngine(get);
  },

  setGroove: (g) => putGroove(get, set, g),

  setGroovePlaying: (on) => {
    const engine = bootEngine();
    if (on) {
      const g = grooveOf(get().patch.groove);
      if (!g.seqOn && !g.drumsOn) putGroove(get, set, { ...g, seqOn: true, drumsOn: true });
    }
    if (on && get().countIn) {
      set({ countingIn: true, groovePlaying: false, grooveStep: -1 });
      engine.setClickOn(true);
      engine.countIn(() => {
        engine.setClickOn(get().clickOn);
        engine.setGroovePlaying(true);
        set({ groovePlaying: true, grooveStep: 0, countingIn: false });
      });
      return;
    }
    if (!on) engine.setClickOn(get().clickOn);
    engine.setGroovePlaying(on);
    if (!on) recOpen.clear();
    set({ groovePlaying: on, grooveStep: on ? 0 : -1, countingIn: false });
  },

  setRecMode: (mode) => {
    const s = get();
    if (mode === "off") {
      recOpen.clear();
      recDidSnap = false;
    }
    if (mode !== "off") {
      const g = grooveOf(s.patch.groove);
      if (!g.seqOn && !g.drumsOn) putGroove(get, set, { ...g, seqOn: true, drumsOn: true });
    }
    set({ recMode: mode });
    if (mode === "live" && !get().groovePlaying) {
      bootEngine().setGroovePlaying(true);
      set({ groovePlaying: true });
    }
  },

  undoGroove: () => {
    const s = get();
    if (!s.grooveUndo.length) return;
    const prev = s.grooveUndo[s.grooveUndo.length - 1]!;
    const grooveUndo = s.grooveUndo.slice(0, -1);
    const cur = snapshotGroove(grooveOf(s.patch.groove));
    recOpen.clear();
    recDidSnap = false;
    putGroove(get, set, prev);
    set({ grooveUndo, grooveRedo: [...s.grooveRedo, cur].slice(-UNDO_MAX), recMode: "off" });
  },

  redoGroove: () => {
    const s = get();
    if (!s.grooveRedo.length) return;
    const next = s.grooveRedo[s.grooveRedo.length - 1]!;
    const grooveRedo = s.grooveRedo.slice(0, -1);
    const cur = snapshotGroove(grooveOf(s.patch.groove));
    recOpen.clear();
    recDidSnap = false;
    putGroove(get, set, next);
    set({ grooveUndo: [...s.grooveUndo, cur].slice(-UNDO_MAX), grooveRedo, recMode: "off" });
  },

  loadPhrase: (id) => putGroove(get, set, applyPhrase(grooveOf(get().patch.groove), id), true),
  loadBeat: (id) => putGroove(get, set, applyBeat(grooveOf(get().patch.groove), id), true),
  loadGroovePreset: (id) => {
    putGroove(get, set, applyGroovePreset(id, grooveOf(get().patch.groove)), true);
  },

  hitDrum: (part, vel = 0.88) => {
    const engine = bootEngine();
    const s = get();
    const g = grooveOf(s.patch.groove);
    if (!g.drumMute[part]) engine.hitDrum(part, vel);
    if (s.recMode === "off" || !g.drumsOn || !g.drumArm[part]) return;
    if (s.recMode === "wait") {
      engine.setGroovePlaying(true);
      set({ groovePlaying: true, recMode: "live" });
    }
    const idx = recIndex();
    recSnap(get, set);
    const groove = snapshotGroove(g);
    const lane = groove.drums[part].slice();
    lane[idx] = { on: true, vel };
    groove.drums = { ...groove.drums, [part]: lane };
    putGroove(get, set, groove);
  },

  clearNoteTrack: (track) => putGroove(get, set, wipeNoteTrack(grooveOf(get().patch.groove), track), true),
  clearDrumLane: (part) => putGroove(get, set, wipeDrumLane(grooveOf(get().patch.groove), part), true),

  saveUserSequence: (name) => {
    const groove = snapshotGroove(grooveOf(get().patch.groove));
    const item: UserSequence = {
      id: `seq-${Date.now()}`,
      name: name.trim() || "Sequence",
      groove,
    };
    const userSequences = [...get().userSequences, item];
    saveSeqs(userSequences);
    set({ userSequences });
  },

  renameUserSequence: (id, name) => {
    const next = name.trim();
    if (!next) return;
    const userSequences = get().userSequences.map((x) => (x.id === id ? { ...x, name: next } : x));
    saveSeqs(userSequences);
    set({ userSequences });
  },

  deleteUserSequence: (id) => {
    const userSequences = get().userSequences.filter((x) => x.id !== id);
    saveSeqs(userSequences);
    set({ userSequences });
  },

  loadUserSequence: (id) => {
    const found = get().userSequences.find((x) => x.id === id);
    if (!found) return;
    putGroove(get, set, snapshotGroove(found.groove), true);
  },

  hydrate: () => {
    let showKeys = true;
    let midiPortId = "all";
    let clockFollow = false;
    try {
      showKeys = localStorage.getItem(KEYS_KEY) !== "0";
      midiPortId = localStorage.getItem(PORT_KEY) || "all";
      clockFollow = localStorage.getItem(CLOCK_KEY) === "1";
    } catch {
      /* */
    }
    setMidiPortFilter(midiPortId);
    set({
      userPatches: loadUser(),
      userSequences: loadSeqs(),
      favorites: loadFavs(),
      showKeys,
      midiPortId,
      clockFollow,
    });
  },

  exportBackup: () => {
    const blob = new Blob([JSON.stringify(collectBackup(), null, 2)], { type: "application/json" });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    downloadBlob(blob, `lyra-backup-${stamp}.json`);
  },

  importBackup: (raw) => {
    if (!applyBackup(raw)) return false;
    let showKeys = true;
    let midiPortId = "all";
    let clockFollow = false;
    try {
      showKeys = localStorage.getItem(KEYS_KEY) !== "0";
      midiPortId = localStorage.getItem(PORT_KEY) || "all";
      clockFollow = localStorage.getItem(CLOCK_KEY) === "1";
    } catch {
      /* */
    }
    setMidiPortFilter(midiPortId);
    set({
      userPatches: loadUser(),
      userSequences: loadSeqs(),
      favorites: loadFavs(),
      scenes: loadScenes(),
      midiMap: loadMidiMap(),
      showKeys,
      midiPortId,
      clockFollow,
      activeScene: null,
      abSnap: null,
      abOn: false,
    });
    return true;
  },
}));

function clampInt(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function bindComputerKeyboard() {
  const down = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (blocksComputerKeys(e.target)) return;
    const k = e.key.toLowerCase();
    if (k === "z") {
      useSynth.getState().shiftOctave(-1);
      return;
    }
    if (k === "x") {
      useSynth.getState().shiftOctave(1);
      return;
    }
    const digit = e.code.match(/^Digit([1-8])$/);
    if (digit && !e.metaKey && !e.ctrlKey) {
      const i = Number(digit[1]) - 1;
      const st = useSynth.getState();
      if (e.shiftKey || !st.scenes[i]) st.saveScene(i);
      else st.recallScene(i);
      return;
    }
    if (k === "?" ) {
      const s = useSynth.getState();
      s.setHelpOpen(!s.helpOpen);
      return;
    }
    if (k === "escape") {
      if (useSynth.getState().helpOpen) {
        useSynth.getState().setHelpOpen(false);
        return;
      }
      if (useSynth.getState().dawOpen) {
        useSynth.getState().setDawOpen(false);
        return;
      }
      useSynth.getState().panic();
      return;
    }
    if (!(k in QWERTY_MAP)) return;
    e.preventDefault();
    if (heldKeys.has(k)) return;
    const midi = 48 + QWERTY_MAP[k]!;
    heldKeys.set(k, midi);
    useSynth.getState().noteOn(midi, 0.88);
  };
  const up = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (!(k in QWERTY_MAP)) return;
    const midi = heldKeys.get(k);
    heldKeys.delete(k);
    if (midi != null) useSynth.getState().noteOff(midi);
  };
  const flush = () => {
    for (const midi of heldKeys.values()) useSynth.getState().noteOff(midi);
    heldKeys.clear();
  };
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", flush);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", flush);
  };
}

export function bindAudioUnlock() {
  const go = () => {
    useSynth.getState().arm();
  };
  window.addEventListener("pointerdown", go);
  window.addEventListener("keydown", go);
  return () => {
    window.removeEventListener("pointerdown", go);
    window.removeEventListener("keydown", go);
  };
}

if (typeof window !== "undefined") {
  (window as unknown as { __lyra: () => Record<string, unknown> }).__lyra = () => {
    const s = useSynth.getState();
    return {
      armed: s.armed,
      voices: s.voices,
      ctx: s.engine?.ctx.state ?? s.ctxState,
      notes: s.activeNotes,
      cutoffMod: s.cutoffMod,
      setCutoffMod: (v: number) => {
        const n = Math.max(0, Math.min(1, Number(v) || 0));
        s.engine?.setCutoffMod(n);
        useSynth.setState({ cutoffMod: n });
      },
    };
  };
}
