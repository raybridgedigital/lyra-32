export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

export function midiToFreq(midi: number, bendSemis = 0): number {
  return 440 * Math.pow(2, (midi + bendSemis - 69) / 12);
}

export function midiToName(midi: number): string {
  const n = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[n]}${oct}`;
}

/** Computer-keyboard piano: two rows, A = C of the current octave. */
export const QWERTY_MAP: Record<string, number> = {
  a: 0,
  w: 1,
  s: 2,
  e: 3,
  d: 4,
  f: 5,
  t: 6,
  g: 7,
  y: 8,
  h: 9,
  u: 10,
  j: 11,
  k: 12,
  o: 13,
  l: 14,
  p: 15,
  ";": 16,
  "'": 17,
};

export type MidiPortInfo = { id: string; name: string };

export type MidiHandlers = {
  noteOn: (note: number, velocity: number) => void;
  noteOff: (note: number) => void;
  cc: (ctl: number, value: number) => void;
  pitchBend: (semis: number) => void;
  aftertouch?: (value: number) => void;
  onStatus: (status: "ok" | "denied" | "unsupported" | "none", name: string | null) => void;
  onPorts?: (ports: MidiPortInfo[]) => void;
  onClock?: (info: { bpm: number | null; running: boolean }) => void;
};

type MidiInputLike = {
  id: string;
  name?: string | null;
  onmidimessage: ((ev: { data: Uint8Array | null }) => void) | null;
};

type MidiAccessLike = {
  inputs: { values: () => Iterable<MidiInputLike> };
  onstatechange: (() => void) | null;
};

const PORT_ALL = "all";
let selectedPortId = PORT_ALL;
let accessRef: MidiAccessLike | null = null;
let handlersRef: MidiHandlers | null = null;
const clock = createClockTracker();
let lastClockEmit = 0;

export function isIacPort(name: string): boolean {
  return /iac/i.test(name);
}

export function sortMidiPorts(ports: MidiPortInfo[]): MidiPortInfo[] {
  return [...ports].sort((a, b) => {
    const ia = isIacPort(a.name) ? 0 : 1;
    const ib = isIacPort(b.name) ? 0 : 1;
    if (ia !== ib) return ia - ib;
    return a.name.localeCompare(b.name);
  });
}

export function createClockTracker() {
  let stamps: number[] = [];
  let running = false;
  let bpm: number | null = null;
  return {
    get bpm() {
      return bpm;
    },
    get running() {
      return running;
    },
    push(status: number, now = performance.now()): { bpm: number | null; running: boolean } | null {
      if (status === 0xfa || status === 0xfb) {
        running = true;
        stamps = [];
        return { bpm, running };
      }
      if (status === 0xfc) {
        running = false;
        stamps = [];
        return { bpm, running };
      }
      if (status !== 0xf8) return null;
      running = true;
      stamps.push(now);
      if (stamps.length > 48) stamps.shift();
      if (stamps.length >= 12) {
        const span = stamps[stamps.length - 1]! - stamps[0]!;
        const dt = span / (stamps.length - 1);
        const next = 60000 / (dt * 24);
        if (next >= 40 && next <= 300) bpm = next;
      }
      return { bpm, running };
    },
  };
}

export function setMidiPortFilter(id: string) {
  selectedPortId = id || PORT_ALL;
  if (accessRef && handlersRef) attachInputs(accessRef, handlersRef);
}

export async function connectMidi(handlers: MidiHandlers): Promise<() => void> {
  handlersRef = handlers;
  const nav = navigator as Navigator & {
    requestMIDIAccess?: (opts?: { sysex?: boolean }) => Promise<MidiAccessLike>;
  };
  if (typeof nav.requestMIDIAccess !== "function") {
    handlers.onStatus("unsupported", null);
    return () => undefined;
  }
  try {
    const access = (await nav.requestMIDIAccess({ sysex: false })) as MidiAccessLike;
    accessRef = access;
    attachInputs(access, handlers);
    access.onstatechange = () => attachInputs(access, handlers);
    return () => {
      access.onstatechange = null;
      for (const input of access.inputs.values()) input.onmidimessage = null;
      if (accessRef === access) accessRef = null;
    };
  } catch {
    handlers.onStatus("denied", null);
    return () => undefined;
  }
}

function attachInputs(access: MidiAccessLike, handlers: MidiHandlers) {
  const inputs = [...access.inputs.values()];
  const ports = sortMidiPorts(inputs.map((i) => ({ id: i.id, name: i.name?.trim() || "MIDI" })));
  handlers.onPorts?.(ports);
  if (!inputs.length) {
    handlers.onStatus("none", null);
    return;
  }
  const active =
    selectedPortId !== PORT_ALL ? inputs.filter((i) => i.id === selectedPortId) : inputs;
  const listen = active.length ? active : inputs;
  const label = listen.map((i) => i.name ?? "MIDI").join(" · ");
  handlers.onStatus("ok", label);
  for (const input of inputs) {
    const take = selectedPortId === PORT_ALL || input.id === selectedPortId;
    input.onmidimessage = take
      ? (ev) => {
          if (ev.data) parseMidi(ev.data, handlers);
        }
      : null;
  }
}

export function parseMidi(data: Uint8Array, h: MidiHandlers) {
  if (data.length < 1) return;
  const status = data[0]!;
  if (status >= 0xf8) {
    const tick = clock.push(status);
    if (tick && h.onClock) {
      const now = performance.now();
      if (status !== 0xf8 || now - lastClockEmit > 200) {
        lastClockEmit = now;
        h.onClock(tick);
      }
    }
    return;
  }
  const cmd = status & 0xf0;
  const a = data[1] ?? 0;
  const b = data[2] ?? 0;
  if (cmd === 0x90) {
    if (b === 0) h.noteOff(a);
    else h.noteOn(a, b / 127);
  } else if (cmd === 0x80) {
    h.noteOff(a);
  } else if (cmd === 0xb0) {
    h.cc(a, b / 127);
  } else if (cmd === 0xe0) {
    const v14 = (b << 7) | a;
    h.pitchBend(((v14 - 8192) / 8192) * 2);
  } else if (cmd === 0xd0) {
    h.aftertouch?.(a / 127);
  } else if (cmd === 0xa0) {
    h.aftertouch?.(b / 127);
  }
}
