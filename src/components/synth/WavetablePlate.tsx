import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { clonePatch } from "@/lib/synth/patches";
import { useSynth } from "@/lib/synth/store";
import { WT_TABLES, getTable, setUserTable, shapeFromOsc, wtCycle } from "@/lib/synth/wavetable";
import { audioToFrames, decodeWavPcm } from "@/lib/synth/wav-import";
import type { OscParams, Patch, WtWarp } from "@/lib/synth/types";
import { Knob, Seg } from "./Knob";

type Target = "osc1" | "osc2" | "both";

function sampleAt(buf: Float32Array, x: number) {
  const n = buf.length;
  const i = Math.floor(x);
  const f = x - i;
  const a = buf[(i - 1 + n) % n]!;
  const b = buf[i % n]!;
  const c = buf[(i + 1) % n]!;
  const d = buf[(i + 2) % n]!;
  return b + 0.5 * f * (c - a + f * (2 * a - 5 * b + 4 * c - d + f * (3 * (b - c) + d - a)));
}

function findTrigger(buf: Float32Array, period: number) {
  const need = Math.floor(period) + 4;
  const from = Math.max(2, buf.length - need * 2);
  for (let i = buf.length - need - 1; i > from; i--) {
    if (buf[i - 1]! <= 0 && buf[i]! > 0) return i;
  }
  return Math.max(0, buf.length - need);
}

function pathFromCycle(
  ctx: CanvasRenderingContext2D,
  cycle: Float32Array,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.beginPath();
  const mid = y + h / 2;
  for (let i = 0; i < cycle.length; i++) {
    const px = x + (i / (cycle.length - 1)) * w;
    const py = mid - cycle[i]! * h * 0.42;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
}

function fillCycle(
  ctx: CanvasRenderingContext2D,
  cycle: Float32Array,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  pathFromCycle(ctx, cycle, x, y, w, h);
  const mid = y + h / 2;
  ctx.lineTo(x + w, mid);
  ctx.lineTo(x, mid);
  ctx.closePath();
}

export function WavetablePlate({ patch, onChange }: { patch: Patch; onChange: (p: Patch) => void }) {
  const engine = useSynth((s) => s.engine);
  const voices = useSynth((s) => s.voices);
  const activeNotes = useSynth((s) => s.activeNotes);
  const [target, setTarget] = useState<Target>("osc1");
  const [zoom, setZoom] = useState<1 | 2 | 4>(1);
  const [dropOn, setDropOn] = useState(false);
  const [userTick, setUserTick] = useState(0);
  const tableCanvas = useRef<HTMLCanvasElement>(null);
  const liveCanvas = useRef<HTMLCanvasElement>(null);
  const stripRef = useRef<HTMLCanvasElement>(null);
  const gainRef = useRef(1);

  const osc: OscParams = target === "osc2" ? patch.osc2 : patch.osc1;
  const tableId = osc.table ?? "classic";
  const pos = osc.pwm;
  const shape = useMemo(() => shapeFromOsc(osc), [osc]);
  const table = useMemo(() => getTable(tableId), [tableId, userTick]);
  const cycle = useMemo(() => wtCycle(tableId, pos, shape), [tableId, pos, shape, userTick]);

  const applyOsc = (fn: (o: OscParams) => OscParams) => {
    if (target === "both") onChange(clonePatch(patch, { osc1: fn(patch.osc1), osc2: fn(patch.osc2) }));
    else onChange(clonePatch(patch, { [target]: fn(patch[target]) }));
  };

  const takeWav = async (file: File) => {
    const buf = await file.arrayBuffer();
    const pcm = decodeWavPcm(buf);
    if (!pcm) return;
    setUserTable(audioToFrames(pcm));
    setUserTick((n) => n + 1);
    applyOsc((o) => ({ ...o, wave: "wt", table: "user" }));
  };

  useEffect(() => {
    const canvas = stripRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = canvas.clientWidth || 160;
    const cssH = canvas.clientHeight || 220;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    const rowH = cssH / WT_TABLES.length;
    WT_TABLES.forEach((t, i) => {
      const y = i * rowH;
      const on = t.id === tableId;
      if (on) {
        ctx.fillStyle = "rgb(201 137 58 / 0.22)";
        ctx.fillRect(0, y, cssW, rowH);
      }
      const cyc = wtCycle(t.id, pos);
      ctx.strokeStyle = on ? "#c9893a" : "rgb(232 226 214 / 0.38)";
      ctx.lineWidth = on ? 1.6 : 1;
      pathFromCycle(ctx, cyc, 4, y + 2, cssW * 0.58, rowH - 4);
      ctx.stroke();
    });
  }, [tableId, pos, userTick]);

  useEffect(() => {
    const canvas = tableCanvas.current;
    if (!canvas) return;
    let raf = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const draw = () => {
      const cssW = canvas.clientWidth || 480;
      const cssH = canvas.clientHeight || 220;
      if (canvas.width !== Math.floor(cssW * dpr) || canvas.height !== Math.floor(cssH * dpr)) {
        canvas.width = Math.floor(cssW * dpr);
        canvas.height = Math.floor(cssH * dpr);
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.fillStyle = "#0c0f14";
      ctx.fillRect(0, 0, cssW, cssH);

      ctx.strokeStyle = "rgb(232 226 214 / 0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(16, cssH / 2);
      ctx.lineTo(cssW - 16, cssH / 2);
      ctx.stroke();

      const slices = [0, 0.25, 0.5, 0.75, 1];
      for (const z of slices) {
        const frame = wtCycle(table.id, z);
        const x0 = 22 + z * 54;
        const y0 = 10 + (1 - z) * 22;
        const w = cssW - 50 - z * 54;
        const h = cssH * 0.62;
        ctx.strokeStyle = `rgb(201 137 58 / ${z === 0 || z === 1 ? 0.18 : 0.12})`;
        ctx.lineWidth = 1;
        pathFromCycle(ctx, frame, x0, y0, w, h);
        ctx.stroke();
      }

      const x0 = 22 + pos * 54;
      const y0 = 10 + (1 - pos) * 22;
      const w = cssW - 50 - pos * 54;
      const h = cssH * 0.62;
      ctx.fillStyle = "rgb(201 137 58 / 0.16)";
      fillCycle(ctx, cycle, x0, y0, w, h);
      ctx.fill();
      ctx.strokeStyle = "#e8e2d6";
      ctx.lineWidth = 2.2;
      pathFromCycle(ctx, cycle, x0, y0, w, h);
      ctx.stroke();

      ctx.fillStyle = "rgb(201 137 58 / 0.2)";
      ctx.fillRect(18, cssH - 14, cssW - 36, 6);
      ctx.fillStyle = "#c9893a";
      ctx.fillRect(18, cssH - 14, (cssW - 36) * pos, 6);
      ctx.beginPath();
      ctx.arc(18 + (cssW - 36) * pos, cssH - 11, 5, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [table, cycle, pos]);

  useEffect(() => {
    const canvas = liveCanvas.current;
    if (!canvas) return;
    const analyser = engine?.analyser;
    const data = new Float32Array(analyser?.fftSize ?? 4096);
    let raf = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const draw = () => {
      const cssW = canvas.clientWidth || 420;
      const cssH = canvas.clientHeight || 220;
      if (canvas.width !== Math.floor(cssW * dpr) || canvas.height !== Math.floor(cssH * dpr)) {
        canvas.width = Math.floor(cssW * dpr);
        canvas.height = Math.floor(cssH * dpr);
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#0c0f14";
      ctx.fillRect(0, 0, cssW, cssH);

      ctx.strokeStyle = "rgb(232 226 214 / 0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(8, cssH / 2);
      ctx.lineTo(cssW - 8, cssH / 2);
      ctx.stroke();

      const padX = 10;
      const padY = 12;
      const w = cssW - padX * 2;
      const h = cssH - padY * 2;
      const mid = padY + h / 2;
      const live = Boolean(analyser && voices > 0);
      let src: Float32Array = cycle;
      let start = 0;
      let span = cycle.length;
      let amp = 1;

      if (live && analyser) {
        analyser.getFloatTimeDomainData(data);
        const sr = analyser.context.sampleRate;
        const midi = activeNotes[0] ?? 60;
        const hz = 440 * Math.pow(2, (midi - 69) / 12);
        const period = Math.max(32, sr / Math.max(20, hz));
        span = Math.min(data.length - 8, period * zoom);
        start = findTrigger(data, span);
        let peak = 0.04;
        const steps = Math.min(256, Math.floor(span));
        for (let i = 0; i < steps; i++) {
          peak = Math.max(peak, Math.abs(data[Math.min(data.length - 1, start + Math.floor((i / steps) * span))]!));
        }
        gainRef.current += (0.86 / peak - gainRef.current) * 0.12;
        amp = gainRef.current;
        src = data;
      } else {
        gainRef.current += (1 - gainRef.current) * 0.2;
        amp = 1;
        src = cycle;
        start = 0;
        span = cycle.length;
      }

      const yAt = (x: number) => {
        const t = start + (x / w) * (span - 1);
        const v = live && analyser ? sampleAt(src, t) * amp : src[Math.min(src.length - 1, Math.round((x / w) * (src.length - 1)))]! * amp;
        return mid - v * h * 0.46;
      };

      ctx.beginPath();
      for (let x = 0; x <= w; x++) {
        const y = yAt(x);
        if (x === 0) ctx.moveTo(padX + x, y);
        else ctx.lineTo(padX + x, y);
      }
      ctx.lineTo(padX + w, mid);
      ctx.lineTo(padX, mid);
      ctx.closePath();
      ctx.fillStyle = live ? "rgb(201 137 58 / 0.22)" : "rgb(201 137 58 / 0.12)";
      ctx.fill();

      ctx.beginPath();
      for (let x = 0; x <= w; x++) {
        const y = yAt(x);
        if (x === 0) ctx.moveTo(padX + x, y);
        else ctx.lineTo(padX + x, y);
      }
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = live ? "#e8e2d6" : "#c9893a";
      ctx.shadowColor = live ? "rgb(201 137 58 / 0.55)" : "transparent";
      ctx.shadowBlur = live ? 10 : 0;
      ctx.lineWidth = 2.15;
      ctx.stroke();
      ctx.shadowBlur = 0;

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [engine, voices, cycle, zoom, activeNotes]);

  return (
    <section className="lyra-cell lyra-wt lyra-span-full">
      <h2 className="lyra-cell-title">Wavetable</h2>
      <div className="lyra-wt-body">
        <div className="lyra-wt-bank">
          {WT_TABLES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={cn("lyra-wt-chip", t.id === tableId && "is-on")}
              onClick={() => applyOsc((o) => ({ ...o, wave: "wt", table: t.id }))}
            >
              {t.name}
            </button>
          ))}
          <canvas ref={stripRef} className="lyra-wt-strip" aria-hidden />
        </div>
        <div
          className={cn("lyra-wt-stage", dropOn && "is-drop")}
          onDragOver={(e) => {
            e.preventDefault();
            setDropOn(true);
          }}
          onDragLeave={() => setDropOn(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDropOn(false);
            const f = e.dataTransfer.files[0];
            if (f) void takeWav(f);
          }}
        >
          <div className="lyra-wt-pane">
            <div className="lyra-wt-pane-h">Table · {table.name} · drop wav</div>
            <canvas ref={tableCanvas} className="lyra-wt-canvas" aria-hidden />
          </div>
          <div className="lyra-wt-pane">
            <div className="lyra-wt-pane-h">
              <span>{voices > 0 ? "Live · triggered" : "Live · table cycle"}</span>
              <div className="lyra-wt-zoom">
                {([1, 2, 4] as const).map((n) => (
                  <button key={n} type="button" className={cn(zoom === n && "is-on")} onClick={() => setZoom(n)}>
                    {n}×
                  </button>
                ))}
              </div>
            </div>
            <canvas ref={liveCanvas} className="lyra-wt-canvas" aria-hidden />
          </div>
        </div>
        <div className="lyra-wt-side">
          <div className="lyra-wt-targets">
            {(["osc1", "osc2", "both"] as const).map((id) => (
              <button
                key={id}
                type="button"
                className={cn("lyra-wt-tgt", target === id && "is-on")}
                onClick={() => setTarget(id)}
              >
                {id === "osc1" ? "Osc 1" : id === "osc2" ? "Osc 2" : "Both"}
              </button>
            ))}
          </div>
          <Seg
            compact
            value={osc.wtWarpMode ?? "bend"}
            options={
              [
                { id: "bend", label: "Bnd", title: "Bend — Serum-style time warp" },
                { id: "sync", label: "Syn", title: "Sync — hard wrap, extra teeth" },
                { id: "mirror", label: "Flp", title: "Mirror — fold the cycle back" },
                { id: "fold", label: "Fld", title: "Fold — wavefold the table" },
                { id: "quant", label: "Bit", title: "Quantize — digital steps" },
              ] as { id: WtWarp; label: string; title: string }[]
            }
            onChange={(wtWarpMode) => applyOsc((o) => ({ ...o, wave: "wt", wtWarpMode }))}
          />
          <div className="lyra-wt-knobs">
            <Knob
              label="Pos"
              learnId="osc1.pwm"
              value={pos}
              defaultValue={0.5}
              format={(v) => `${Math.round(v * 100)}`}
              onChange={(pwm) => applyOsc((o) => ({ ...o, pwm, wave: "wt" }))}
            />
            <Knob
              label="Warp"
              value={osc.wtWarp ?? 0}
              arm
              armOn={0.45}
              format={(v) => `${Math.round(v * 100)}`}
              onChange={(wtWarp) => applyOsc((o) => ({ ...o, wave: "wt", wtWarp }))}
            />
            <Knob
              label="Form"
              value={osc.wtFormant ?? 0.5}
              defaultValue={0.5}
              format={(v) => `${Math.round((v - 0.5) * 200)}`}
              onChange={(wtFormant) => applyOsc((o) => ({ ...o, wave: "wt", wtFormant }))}
            />
            <Knob
              label="Tone"
              value={osc.wtTone ?? 0.5}
              defaultValue={0.5}
              format={(v) => `${Math.round((v - 0.5) * 200)}`}
              onChange={(wtTone) => applyOsc((o) => ({ ...o, wave: "wt", wtTone }))}
            />
            <Knob
              label="Phase"
              value={osc.wtPhase ?? 0}
              format={(v) => `${Math.round(v * 360)}°`}
              onChange={(wtPhase) => applyOsc((o) => ({ ...o, wave: "wt", wtPhase }))}
            />
            <Knob
              label="Level"
              value={osc.level}
              defaultValue={0.8}
              format={(v) => `${Math.round(v * 100)}`}
              onChange={(level) => applyOsc((o) => ({ ...o, level }))}
            />
          </div>
          <button
            type="button"
            className={cn("lyra-wt-arm", osc.wave === "wt" && "is-on")}
            onClick={() => applyOsc((o) => ({ ...o, wave: o.wave === "wt" ? "sawtooth" : "wt" }))}
          >
            {osc.wave === "wt" ? "Table armed" : "Arm table"}
          </button>
        </div>
      </div>
    </section>
  );
}
