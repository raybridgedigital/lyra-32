export const SHAPE_N = 64;

export type ShapeMode = "env" | "loop";
export type ShapeDest = "amp" | "cutoff" | "pitch" | "pan" | "pwm" | "drive" | "fm";

export type DrawShape = {
  on: boolean;
  mode: ShapeMode;
  dest: ShapeDest;
  time: number;
  depth: number;
  from: number;
  preset?: string;
  points: number[];
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function shapeRamp() {
  return Array.from({ length: SHAPE_N }, (_, i) => i / (SHAPE_N - 1));
}

export function shapeBloom() {
  return pts((t) => t * t * (3 - 2 * t));
}

export function defaultDrawShape(): DrawShape {
  return {
    on: false,
    mode: "env",
    dest: "amp",
    time: 3,
    depth: 1,
    from: 0.15,
    preset: "silk",
    points: shapeBloom(),
  };
}

export function normalizeDrawShape(raw: Partial<DrawShape> | undefined): DrawShape {
  const d = defaultDrawShape();
  if (!raw || typeof raw !== "object") return d;
  const pts = Array.isArray(raw.points)
    ? raw.points.filter((n) => Number.isFinite(n)).map((n) => clamp(n, 0, 1))
    : [];
  const points = pts.length >= 8 ? resamplePoints(pts, SHAPE_N) : d.points;
  const dest = raw.dest;
  const okDest: ShapeDest[] = ["amp", "cutoff", "pitch", "pan", "pwm", "drive", "fm"];
  return {
    on: Boolean(raw.on),
    mode: raw.mode === "loop" ? "loop" : "env",
    dest: dest && okDest.includes(dest) ? dest : "amp",
    time: clamp(Number.isFinite(raw.time) ? (raw.time as number) : 3, 0.15, 12),
    depth: clamp(Number.isFinite(raw.depth) ? (raw.depth as number) : 1, 0, 1),
    from: clamp(Number.isFinite(raw.from) ? (raw.from as number) : d.from, 0, 1),
    preset: typeof raw.preset === "string" && raw.preset ? raw.preset : undefined,
    points,
  };
}

function resamplePoints(pts: number[], n: number) {
  if (pts.length === n) return pts.slice();
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * (pts.length - 1);
    const a = Math.floor(x);
    const b = Math.min(pts.length - 1, a + 1);
    const t = x - a;
    out[i] = pts[a]! * (1 - t) + pts[b]! * t;
  }
  return out;
}

export function shapedPoints(points: number[], from = 0) {
  const p = points.length ? points : shapeRamp();
  const floor = clamp(from, 0, 1);
  if (floor <= 0.0001) return p.slice();
  return p.map((y) => floor + (1 - floor) * y);
}

export function sampleShape(points: number[], t: number, from = 0) {
  const p = shapedPoints(points, from);
  const x = clamp(t, 0, 1) * (p.length - 1);
  const i = Math.floor(x);
  const j = Math.min(p.length - 1, i + 1);
  const f = x - i;
  return p[i]! * (1 - f) + p[j]! * f;
}

export const SHAPE_PRESETS: { id: string; name: string; points: () => number[]; from?: number }[] = [
  { id: "silk", name: "Silk", points: shapeBloom, from: 0.15 },
  { id: "lift", name: "Lift", points: shapeRamp, from: 0.15 },
  { id: "glow", name: "Glow", points: () => pts((t) => Math.pow(t, 2.2)), from: 0.15 },
  { id: "rush", name: "Rush", points: () => pts((t) => Math.pow(t, 3.4)), from: 0.15 },
  { id: "zig", name: "Zig", points: () => pts((t) => Math.abs(((t * 4) % 2) - 1)), from: 0 },
  { id: "step", name: "Step", points: () => pts((t) => Math.floor(t * 4.0001) / 3), from: 0 },
  { id: "snap", name: "Snap", points: () => pts((t) => (t < 0.68 ? 0.04 : 1)), from: 0 },
  { id: "pluck", name: "Pluck", points: () => pts((t) => Math.exp(-t * 5.2)), from: 0 },
  { id: "hold", name: "Hold", points: () => pts((t) => (t < 0.22 ? t / 0.22 : 1)), from: 0 },
  { id: "fall", name: "Fall", points: () => pts((t) => 1 - t), from: 0 },
  { id: "arc", name: "Arc", points: () => pts((t) => 0.5 - 0.5 * Math.cos(t * Math.PI)), from: 0 },
  { id: "dip", name: "Dip", points: () => pts((t) => 1 - Math.sin(t * Math.PI) * 0.85), from: 0 },
  { id: "pulse", name: "Pulse", points: () => pts((t) => (t < 0.18 ? 1 : 0.08)), from: 0 },
  { id: "spike", name: "Spike", points: () => pts((t) => Math.exp(-Math.pow((t - 0.72) * 9, 2))), from: 0 },
  { id: "trem", name: "Trem", points: () => pts((t) => 0.12 + 0.88 * Math.pow(Math.sin(t * Math.PI * 4), 2)), from: 0 },
  { id: "gate", name: "Gate", points: () => pts((t) => (Math.floor(t * 8) % 2 === 0 ? 1 : 0.05)), from: 0 },
  { id: "chop", name: "Chop", points: () => pts((t) => (Math.floor(t * 7) % 2 === 0 && t < 0.86 ? 1 : 0.05)), from: 0 },
  { id: "warp", name: "Warp", points: () => pts((t) => (t < 0.62 ? Math.pow(t / 0.62, 0.55) : 1 - (t - 0.62) / 0.38)), from: 0 },
];

function pts(fn: (t: number) => number) {
  return Array.from({ length: SHAPE_N }, (_, i) => clamp(fn(i / (SHAPE_N - 1)), 0, 1));
}
