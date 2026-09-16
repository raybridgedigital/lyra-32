import { WT_FRAMES, WT_N } from "./wavetable";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function decodeWavPcm(buf: ArrayBuffer): Float32Array | null {
  if (buf.byteLength < 44) return null;
  const v = new DataView(buf);
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") return null;
  let o = 12;
  let fmt = 1;
  let ch = 1;
  let bits = 16;
  let dataOff = -1;
  let dataLen = 0;
  while (o + 8 <= v.byteLength) {
    const id = tag(o);
    const size = v.getUint32(o + 4, true);
    const body = o + 8;
    if (id === "fmt ") {
      fmt = v.getUint16(body, true);
      ch = Math.max(1, v.getUint16(body + 2, true));
      bits = v.getUint16(body + 14, true);
    } else if (id === "data") {
      dataOff = body;
      dataLen = size;
      break;
    }
    o = body + size + (size % 2);
  }
  if (dataOff < 0) return null;
  const bytes = Math.min(dataLen, v.byteLength - dataOff);
  const mono: number[] = [];
  if (fmt === 3 && bits === 32) {
    const n = Math.floor(bytes / 4);
    for (let i = 0; i < n; i += ch) {
      let s = 0;
      for (let c = 0; c < ch; c++) s += v.getFloat32(dataOff + (i + c) * 4, true);
      mono.push(s / ch);
    }
  } else if (bits === 16) {
    const n = Math.floor(bytes / 2);
    for (let i = 0; i < n; i += ch) {
      let s = 0;
      for (let c = 0; c < ch; c++) s += v.getInt16(dataOff + (i + c) * 2, true) / 32768;
      mono.push(s / ch);
    }
  } else if (bits === 8) {
    for (let i = 0; i < bytes; i += ch) {
      let s = 0;
      for (let c = 0; c < ch; c++) s += (v.getUint8(dataOff + i + c) - 128) / 128;
      mono.push(s / ch);
    }
  } else {
    return null;
  }
  if (mono.length < 32) return null;
  return Float32Array.from(mono);
}

export function audioToFrames(samples: Float32Array): Float32Array[] {
  const src = samples.length >= WT_N ? samples : stretch(samples, WT_N);
  const frames: Float32Array[] = [];
  for (let f = 0; f < WT_FRAMES; f++) {
    const origin = src.length <= WT_N ? 0 : Math.floor((f / Math.max(1, WT_FRAMES - 1)) * (src.length - WT_N));
    const start = snapZero(src, origin);
    const cycle = new Float32Array(WT_N);
    const span = Math.min(WT_N, src.length);
    for (let i = 0; i < WT_N; i++) cycle[i] = src[(start + i) % span]!;
    let m = 0;
    for (let i = 0; i < WT_N; i++) m = Math.max(m, Math.abs(cycle[i]!));
    if (m > 1e-6) {
      const g = 0.92 / m;
      for (let i = 0; i < WT_N; i++) cycle[i]! *= g;
    }
    frames.push(cycle);
  }
  return frames;
}

function stretch(s: Float32Array, n: number) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * (s.length - 1);
    const a = Math.floor(x);
    const b = Math.min(s.length - 1, a + 1);
    out[i] = s[a]! * (1 - (x - a)) + s[b]! * (x - a);
  }
  return out;
}

function snapZero(s: Float32Array, from: number) {
  const max = Math.min(s.length - 8, from + 64);
  for (let i = clamp(from, 1, s.length - 2); i < max; i++) {
    if (s[i - 1]! <= 0 && s[i]! > 0) return i;
  }
  return clamp(from, 0, Math.max(0, s.length - WT_N));
}
