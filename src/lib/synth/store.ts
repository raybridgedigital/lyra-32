import { create } from "zustand";
import type { MidiStatus, Patch } from "./types";
import { FACTORY, INIT_PATCH, clonePatch } from "./patches";
import { LyraEngine, createEngine } from "./engine";
import { QWERTY_MAP, connectMidi, setMidiPortFilter, type MidiPortInfo } from "./midi";

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
  voices: number;
  octave: number;
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
  panic: () => void;
  toggleMute: () => void;
  toggleKeys: () => void;
  setMidiPort: (id: string) => void;
  setClockFollow: (on: boolean) => void;
  setDawOpen: (on: boolean) => void;
  hydrate: () => void;
};

let midiUnsub: (() => void) | null = null;
let midiQueued = false;
const heldKeys = new Map<string, number>();

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
  voices: 0,
  octave: 0,
  activeNotes: [],
  arpStep: -1,
  masterMute: false,
  showKeys: typeof window === "undefined" ? true : localStorage.getItem(KEYS_KEY) !== "0",
  engine: null,

  arm: () => {
    bootEngine();
  },

  loadPatch: (p) => {
    const next = clonePatch(p);
    set({ patch: next });
    get().engine?.applyPatch(next);
  },

  setPatch: (p) => {
    set({ patch: p });
    get().engine?.applyPatch(p);
  },

  saveUserPatch: (name) => {
    const p = clonePatch(get().patch, {
      id: `user-${Date.now()}`,
      name: name.trim() || "User patch",
      category: "User",
    });
    const userPatches = [...get().userPatches, p];
    saveUser(userPatches);
    set({ userPatches, patch: p });
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
    try {
      engine.noteOn(midi, vel);
    } catch (err) {
      console.error("lyra noteOn", err);
    }
    const { activeNotes } = get();
    if (!activeNotes.includes(midi)) set({ activeNotes: [...activeNotes, midi] });
  },

  noteOff: (midi) => {
    get().engine?.noteOff(midi);
    set({ activeNotes: get().activeNotes.filter((n) => n !== midi) });
  },

  shiftOctave: (d) => set({ octave: clampInt(get().octave + d, -3, 4) }),

  panic: () => {
    get().engine?.panic();
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

  setDawOpen: (on) => set({ dawOpen: on }),

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
    if (k === "escape") {
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
    const midi = 48 + useSynth.getState().octave * 12 + QWERTY_MAP[k]!;
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
