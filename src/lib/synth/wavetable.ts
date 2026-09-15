export const WT_N = 256;
export const WT_FRAMES = 16;

export type WtTable = {
  id: string;
  name: string;
  frames: Float32Array[];
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function normalize(buf: Float32Array) {
  let m = 0;
  for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i]!));
  if (m < 1e-6) return buf;
  const g = 0.92 / m;
  for (let i = 0; i < buf.length; i++) buf[i]! *= g;
  return buf;
}

function cycle(fn: (t: number, i: number) => number) {
  const out = new Float32Array(WT_N);
  for (let i = 0; i < WT_N; i++) out[i] = fn(i / WT_N, i);
  return normalize(out);
}

function sineSum(partials: Array<[n: number, a: number, p?: number]>) {
  return cycle((t) => {
    const ang = t * Math.PI * 2;
    let s = 0;
    for (const [n, a, p = 0] of partials) s += a * Math.sin(n * ang + p);
    return s;
  });
}

function lerpFrame(a: Float32Array, b: Float32Array, x: number) {
  const out = new Float32Array(WT_N);
  const t = clamp(x, 0, 1);
  for (let i = 0; i < WT_N; i++) out[i] = a[i]! * (1 - t) + b[i]! * t;
  return out;
}

function framesFrom(fn: (u: number) => Float32Array): Float32Array[] {
  return Array.from({ length: WT_FRAMES }, (_, i) => fn(i / (WT_FRAMES - 1)));
}

function classic(u: number) {
  const duty = 0.5 - u * 0.38;
  return sineSum(
    Array.from({ length: 32 }, (_, k) => {
      const n = k + 1;
      const saw = 0.55 / n;
      const sqr = n % 2 === 1 ? 0.7 / n : 0;
      const pulse = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
      const a = (1 - u) * saw + u * 0.45 * sqr + u * 0.7 * pulse;
      return [n, a] as [number, number];
    }),
  );
}

function vowel(u: number) {
  const f1 = 2.2 + u * 3.4;
  const f2 = 8 + (1 - u) * 6;
  const f3 = 14 + u * 4;
  return sineSum([
    [1, 0.7],
    [Math.round(f1), 0.85],
    [Math.round(f2), 0.5],
    [Math.round(f3), 0.28],
    [2, 0.18],
    [3, 0.12 * (1 - u)],
    [5, 0.08],
  ]);
}

function glass(u: number) {
  return sineSum(
    Array.from({ length: 24 }, (_, k) => {
      const n = k + 1;
      const decay = Math.pow(0.72 - u * 0.18, n);
      const odd = n % 2 === 1 ? 1 : 0.25 + u * 0.4;
      return [n, decay * odd, n * u * 0.4] as [number, number, number];
    }),
  );
}

function sync(u: number) {
  const ratio = 1 + u * 7.5;
  return cycle((t) => {
    const x = (t * ratio) % 1;
    return x * 2 - 1;
  });
}

function formant(u: number) {
  const p1 = 3 + u * 5;
  const p2 = 10 - u * 4;
  return sineSum([
    [1, 0.4],
    [Math.max(1, Math.round(p1)), 1],
    [Math.max(2, Math.round(p2)), 0.65],
    [Math.round(p1 + p2) % 16 || 7, 0.3],
    [4, 0.12],
  ]);
}

function metal(u: number) {
  return sineSum([
    [1, 0.55],
    [1.5, 0.2 + u * 0.35],
    [2.7, 0.28],
    [4.3, 0.22 + u * 0.2],
    [6.1, 0.12],
    [9.4, 0.1 * u],
    [2, 0.18],
    [3, 0.14],
    [5, 0.08],
  ]);
}

function organ(u: number) {
  const bars = [1, 0.7 - u * 0.2, 0.45, 0.55 * u, 0.22, 0.18 + u * 0.25, 0.08, 0.12];
  return sineSum(bars.map((a, i) => [i + 1, a] as [number, number]));
}

function bell(u: number) {
  return sineSum([
    [1, 0.7],
    [2.4, 0.45],
    [3.7, 0.28 + u * 0.2],
    [5.1, 0.16],
    [6.8, 0.12 * u],
    [8.2, 0.08],
    [0.5, 0.1 * (1 - u)],
  ]);
}

function digital(u: number) {
  const steps = 4 + Math.round(u * 12);
  return cycle((t) => {
    const raw = Math.sin(t * Math.PI * 2) + u * 0.45 * Math.sin(t * Math.PI * 6);
    const q = Math.round(raw * steps) / steps;
    return q;
  });
}

function vocal(u: number) {
  const a = 0.2 + u * 0.7;
  return sineSum([
    [1, 0.8],
    [2, 0.35 * (1 - a)],
    [3, 0.55],
    [4, 0.12],
    [5, 0.4 * a],
    [7, 0.22],
    [9, 0.12 * a],
    [11, 0.08],
  ]);
}

function fold(u: number) {
  const amt = 1 + u * 5;
  return cycle((t) => {
    let x = Math.sin(t * Math.PI * 2) * amt;
    for (let k = 0; k < 4; k++) {
      if (x > 1) x = 2 - x;
      if (x < -1) x = -2 - x;
    }
    return x;
  });
}

function grit(u: number) {
  return cycle((t, i) => {
    const saw = t * 2 - 1;
    const buzz = ((i * 17 + Math.floor(u * 50)) % 11) / 11 - 0.5;
    const sq = t % 1 < 0.5 - u * 0.2 ? 1 : -1;
    return saw * (1 - u * 0.4) + sq * u * 0.45 + buzz * u * 0.35;
  });
}

export const WT_TABLES: WtTable[] = [
  { id: "classic", name: "Classic", frames: framesFrom(classic) },
  { id: "vowel", name: "Vowel", frames: framesFrom(vowel) },
  { id: "glass", name: "Glass", frames: framesFrom(glass) },
  { id: "sync", name: "Sync", frames: framesFrom(sync) },
  { id: "formant", name: "Formant", frames: framesFrom(formant) },
  { id: "metal", name: "Metal", frames: framesFrom(metal) },
  { id: "organ", name: "Organ", frames: framesFrom(organ) },
  { id: "bell", name: "Bell", frames: framesFrom(bell) },
  { id: "digital", name: "Digital", frames: framesFrom(digital) },
  { id: "vocal", name: "Vocal", frames: framesFrom(vocal) },
  { id: "fold", name: "Fold", frames: framesFrom(fold) },
  { id: "grit", name: "Grit", frames: framesFrom(grit) },
];

const tableMap = new Map(WT_TABLES.map((t) => [t.id, t]));

export function getTable(id: string | undefined) {
  return tableMap.get(id ?? "") ?? WT_TABLES[0]!;
}

export function wtCycle(id: string | undefined, pos: number, shape?: Partial<WtShape>) {
  const table = getTable(id);
  const x = clamp(pos, 0, 1) * (table.frames.length - 1);
  const i = Math.floor(x);
  const j = Math.min(table.frames.length - 1, i + 1);
  const raw = lerpFrame(table.frames[i]!, table.frames[j]!, x - i);
  return applyShape(raw, { ...WT_DEFAULT, ...shape });
}

function at(cyc: Float32Array, t: number) {
  const n = cyc.length;
  const x = (((t % 1) + 1) % 1) * n;
  const i = Math.floor(x);
  const f = x - i;
  return cyc[i % n]! * (1 - f) + cyc[(i + 1) % n]! * f;
}

function warpT(t: number, mode: WtWarp, amt: number) {
  const a = clamp(amt, 0, 1);
  if (a < 0.01 || mode === "fold" || mode === "quant") return t;
  if (mode === "sync") return (t * (1 + a * 8)) % 1;
  if (mode === "bend") return Math.pow(t, Math.pow(2, a * 2.1));
  if (mode === "mirror") {
    const x = (t * (1 + a * 3)) % 2;
    return x < 1 ? x : 2 - x;
  }
  return t;
}

function formantT(t: number, form: number) {
  const a = (clamp(form, 0, 1) - 0.5) * 2;
  if (Math.abs(a) < 0.02) return t;
  const exp = a >= 0 ? 1 + a * 1.7 : 1 / (1 - a * 1.7);
  return Math.pow(clamp(t, 0, 1), exp);
}

function foldV(v: number, amt: number) {
  let x = v * (1 + amt * 6);
  for (let k = 0; k < 6; k++) {
    if (x > 1) x = 2 - x;
    if (x < -1) x = -2 - x;
  }
  return x;
}

function applyShape(raw: Float32Array, s: WtShape) {
  const n = raw.length;
  const out = new Float32Array(n);
  const mode = s.warpMode;
  const warp = clamp(s.warp, 0, 1);
  const phase = clamp(s.phase, 0, 1);
  for (let i = 0; i < n; i++) {
    let t = i / n;
    t = warpT(t, mode, warp);
    t = formantT(t, s.formant);
    t = t + phase;
    let v = at(raw, t);
    if (mode === "fold" && warp > 0.01) v = foldV(v, warp);
    if (mode === "quant" && warp > 0.01) {
      const steps = 2 + Math.round(warp * 16);
      v = Math.round(v * steps) / steps;
    }
    out[i] = v;
  }
  const tone = clamp(s.tone, 0, 1);
  if (Math.abs(tone - 0.5) > 0.02) {
    const tmp = new Float32Array(n);
    let y = out[0]!;
    const lp = tone < 0.5 ? 0.12 + (0.5 - tone) * 0.75 : 0.55;
    for (let i = 0; i < n * 2; i++) {
      const idx = i % n;
      y += (out[idx]! - y) * lp;
      if (i >= n) tmp[idx] = y;
    }
    if (tone < 0.5) {
      for (let i = 0; i < n; i++) out[i] = tmp[i]!;
    } else {
      const bright = (tone - 0.5) * 2;
      for (let i = 0; i < n; i++) out[i] = out[i]! + (out[i]! - tmp[i]!) * bright * 1.4;
    }
  }
  return normalize(out);
}

export const WT_DEFAULT: WtShape = { warp: 0, warpMode: "bend", formant: 0.5, tone: 0.5, phase: 0 };

export type WtWarp = "bend" | "sync" | "mirror" | "fold" | "quant";
export type WtShape = {
  warp: number;
  warpMode: WtWarp;
  formant: number;
  tone: number;
  phase: number;
};

export function shapeFromOsc(o: {
  wtWarp?: number;
  wtWarpMode?: WtWarp;
  wtFormant?: number;
  wtTone?: number;
  wtPhase?: number;
}): WtShape {
  return {
    warp: Number.isFinite(o.wtWarp) ? clamp(o.wtWarp!, 0, 1) : 0,
    warpMode: o.wtWarpMode ?? "bend",
    formant: Number.isFinite(o.wtFormant) ? clamp(o.wtFormant!, 0, 1) : 0.5,
    tone: Number.isFinite(o.wtTone) ? clamp(o.wtTone!, 0, 1) : 0.5,
    phase: Number.isFinite(o.wtPhase) ? clamp(o.wtPhase!, 0, 1) : 0,
  };
}

function dft(cycleBuf: Float32Array, harmonics = 64) {
  const n = cycleBuf.length;
  const real = new Float32Array(harmonics);
  const imag = new Float32Array(harmonics);
  for (let k = 1; k < harmonics; k++) {
    let r = 0;
    let im = 0;
    const step = (2 * Math.PI * k) / n;
    for (let i = 0; i < n; i++) {
      const a = cycleBuf[i]!;
      const ang = step * i;
      r += a * Math.cos(ang);
      im -= a * Math.sin(ang);
    }
    real[k] = (2 * r) / n;
    imag[k] = (2 * im) / n;
  }
  return { real, imag };
}

const waveCache = new WeakMap<AudioContext, Map<string, PeriodicWave>>();

export function wtPeriodic(ctx: AudioContext, id: string | undefined, pos: number, shape?: Partial<WtShape>) {
  const s = { ...WT_DEFAULT, ...shape };
  const q = Math.round(clamp(pos, 0, 1) * 64);
  const qw = Math.round(s.warp * 16);
  const qf = Math.round(s.formant * 12);
  const qt = Math.round(s.tone * 12);
  const qp = Math.round(s.phase * 16);
  const key = `${id ?? "classic"}:${q}:${s.warpMode}:${qw}:${qf}:${qt}:${qp}`;
  let map = waveCache.get(ctx);
  if (!map) {
    map = new Map();
    waveCache.set(ctx, map);
  }
  let w = map.get(key);
  if (!w) {
    const { real, imag } = dft(wtCycle(id, q / 64, s));
    w = ctx.createPeriodicWave(real, imag);
    map.set(key, w);
  }
  return w;
}

export function isWtId(id: string | undefined) {
  return Boolean(id && tableMap.has(id));
}
