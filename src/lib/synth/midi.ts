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

export type MidiHandlers = {
  noteOn: (note: number, velocity: number) => void;
  noteOff: (note: number) => void;
  cc: (ctl: number, value: number) => void;
  pitchBend: (semis: number) => void;
  onStatus: (status: "ok" | "denied" | "unsupported" | "none", name: string | null) => void;
};

type MidiInputLike = {
  id: string;
  name?: string;
  onmidimessage: ((ev: { data: Uint8Array }) => void) | null;
};

type MidiAccessLike = {
  inputs: { values: () => Iterable<MidiInputLike> };
  onstatechange: (() => void) | null;
};

export async function connectMidi(handlers: MidiHandlers): Promise<() => void> {
  const nav = navigator as Navigator & {
    requestMIDIAccess?: (opts?: { sysex?: boolean }) => Promise<MidiAccessLike>;
  };
  if (typeof nav.requestMIDIAccess !== "function") {
    handlers.onStatus("unsupported", null);
    return () => undefined;
  }
  try {
    const access = await nav.requestMIDIAccess({ sysex: false });
    const bind = () => {
      const inputs = [...access.inputs.values()];
      if (!inputs.length) {
        handlers.onStatus("none", null);
        return;
      }
      handlers.onStatus("ok", inputs.map((i) => i.name ?? "MIDI").join(" · "));
      for (const input of inputs) {
        input.onmidimessage = (ev) => {
          if (ev.data) parseMidi(ev.data, handlers);
        };
      }
    };
    bind();
    access.onstatechange = bind;
    return () => {
      access.onstatechange = null;
      for (const input of access.inputs.values()) input.onmidimessage = null;
    };
  } catch {
    handlers.onStatus("denied", null);
    return () => undefined;
  }
}

function parseMidi(data: Uint8Array, h: MidiHandlers) {
  if (data.length < 1) return;
  const status = data[0]!;
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
    h.cc(74, a / 127);
  }
}
