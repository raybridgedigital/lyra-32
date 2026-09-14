import { create } from "zustand";
import type { LayerId, LayerMix, MidiStatus, Patch, StackMode } from "./types";
import { FACTORY, INIT_PATCH, clonePatch } from "./patches";
import { LyraEngine, createEngine } from "./engine";
import { QWERTY_MAP, connectMidi, setMidiPortFilter, type MidiPortInfo } from "./midi";
import { defaultMix } from "./stack";

const USER_KEY = "lyra32-user-patches";
const KEYS_KEY = "lyra32-show-keys";
const PORT_KEY = "lyra32-midi-port";
const CLOCK_KEY = "lyra32-clock-follow";
const FAV_KEY = "lyra32-favorites";

function loadUser(): Patch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Patch[];
    return Array.isArray(parsed) ? parsed : [];
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
  favorites: string[];
  armed: boolean;
  ctxState: AudioContextState | "none";
  midiStatus: MidiStatus;
  midiName: string | null;
  midiPorts: MidiPortInfo[];
  midiPortId: string;
  clockBpm: number | null;
  clockRunning: boolean;
  clockFollow: boolean;
  dawOpen: boolean;
  helpOpen: boolean;
  voices: number;
  octave: number;
  transpose: number;
  activeNotes: number[];
  arpStep: number;
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
  noteOn: (midi: number, vel?: number) => void;
  noteOff: (midi: number) => void;
  shiftOctave: (d: number) => void;
  shiftTranspose: (d: number) => void;
  panic: () => void;
  toggleMute: () => void;
  toggleKeys: () => void;
  setMidiPort: (id: string) => void;
  setClockFollow: (on: boolean) => void;
  setDawOpen: (on: boolean) => void;
  setHelpOpen: (on: boolean) => void;
  selectLayer: (id: LayerId) => void;
  setLayerOn: (id: LayerId, on: boolean) => void;
  setLayerLevel: (id: LayerId, level: number) => void;
  setLayerPan: (id: LayerId, pan: number) => void;
  setStackMode: (mode: StackMode) => void;
  setSplitNote: (note: number) => void;
  hydrate: () => void;
};

function shareFx(from: Patch, onto: Patch): Patch {
  return clonePatch(onto, { fx: from.fx, arp: from.arp, master: from.master });
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
}
let midiUnsub: (() => void) | null = null;
let midiQueued = false;
const heldKeys = new Map<string, number>();
const soundingByInput = new Map<number, number>();

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
        if (ctl === 1 || ctl === 74) engine.setCutoffMod(value);
        if (ctl === 7) {
          const p = clonePatch(useSynth.getState().patch, { master: value });
          useSynth.getState().setPatch(p);
        }
        if (ctl === 64) engine.setSustain(value >= 0.5);
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

function unlockHtml() {
  try {
    const a = new Audio(
      "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA",
    );
    a.volume = 0.01;
    void a.play();
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
    onState: (ctxState) => useSynth.setState({ ctxState, armed: ctxState === "running" || useSynth.getState().armed }),
  });
  engine.applyPatch(useSynth.getState().patch);
  useSynth.setState({ engine, armed: true, ctxState: engine.ctx.state });
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
  favorites: loadFavs(),
  armed: false,
  ctxState: "none",
  midiStatus: "idle",
  midiName: null,
  midiPorts: [],
  midiPortId: "all",
  clockBpm: null,
  clockRunning: false,
  clockFollow: false,
  dawOpen: false,
  helpOpen: false,
  voices: 0,
  octave: 0,
  transpose: 0,
  activeNotes: [],
  arpStep: -1,
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
    const sounded = clampInt(midi + get().octave * 12 + get().transpose, 0, 127);
    soundingByInput.set(midi, sounded);
    try {
      engine.noteOn(sounded, vel);
    } catch (err) {
      console.error("lyra noteOn", err);
    }
    const { activeNotes } = get();
    if (!activeNotes.includes(sounded)) set({ activeNotes: [...activeNotes, sounded] });
  },

  noteOff: (midi) => {
    const sounded = soundingByInput.get(midi) ?? clampInt(midi + get().octave * 12 + get().transpose, 0, 127);
    soundingByInput.delete(midi);
    get().engine?.noteOff(sounded);
    set({ activeNotes: get().activeNotes.filter((n) => n !== sounded) });
  },

  shiftOctave: (d) => set({ octave: clampInt(get().octave + d, -3, 4) }),
  shiftTranspose: (d) => set({ transpose: clampInt(get().transpose + d, -24, 24) }),

  panic: () => {
    get().engine?.panic();
    soundingByInput.clear();
    set({ activeNotes: [] });
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

  setDawOpen: (on) => set({ dawOpen: on, helpOpen: on ? false : get().helpOpen }),
  setHelpOpen: (on) => set({ helpOpen: on, dawOpen: on ? false : get().dawOpen }),

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
    set({ userPatches: loadUser(), favorites: loadFavs(), showKeys, midiPortId, clockFollow });
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
    };
  };
}
