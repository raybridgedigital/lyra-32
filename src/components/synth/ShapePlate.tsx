import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { clonePatch } from "@/lib/synth/patches";
import { useSynth } from "@/lib/synth/store";
import {
  SHAPE_N,
  SHAPE_PRESETS,
  normalizeDrawShape,
  shapedPoints,
  type ShapeDest,
  type ShapeMode,
} from "@/lib/synth/draw-shape";
import type { Patch } from "@/lib/synth/types";
import { Knob, Seg } from "./Knob";

const DESTS: { id: ShapeDest; label: string; title: string }[] = [
  { id: "amp", label: "Amp", title: "Volume" },
  { id: "cutoff", label: "Cut", title: "Filter cutoff" },
  { id: "pwm", label: "Pos", title: "Wavetable position / PWM" },
  { id: "pitch", label: "Pch", title: "Pitch" },
  { id: "pan", label: "Pan", title: "Stereo pan" },
  { id: "drive", label: "Drv", title: "Drive" },
  { id: "fm", label: "FM", title: "FM index" },
];

export function ShapePlate({ patch, onChange }: { patch: Patch; onChange: (p: Patch) => void }) {
  const engine = useSynth((s) => s.engine);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [slot, setSlot] = useState<1 | 2>(1);
  const sh = normalizeDrawShape(slot === 2 ? patch.drawShape2 : patch.drawShape);
  const pointsRef = useRef(sh.points);
  const fromRef = useRef(sh.from);
  pointsRef.current = sh.points;
  fromRef.current = sh.from;

  const setShape = (over: Partial<typeof sh>) => {
    const next = { ...sh, ...over };
    onChange(clonePatch(patch, slot === 2 ? { drawShape2: next } : { drawShape: next }));
  };

  const paint = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
    const y = Math.max(0, Math.min(1, 1 - (ev.clientY - r.top) / r.height));
    const raw = pointsRef.current.slice();
    const floor = fromRef.current;
    const toRaw = (v: number) => (floor >= 0.999 ? v : (v - floor) / (1 - floor));
    const i = Math.round(x * (SHAPE_N - 1));
    const brush = 1;
    for (let k = -brush; k <= brush; k++) {
      const j = i + k;
      if (j < 0 || j >= SHAPE_N) continue;
      const w = 1 - Math.abs(k) / (brush + 1);
      raw[j] = raw[j]! * (1 - w) + Math.max(0, Math.min(1, toRaw(y))) * w;
    }
    pointsRef.current = raw;
    setShape({ points: raw, on: true, preset: "" });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      if (canvas.width !== Math.floor(cssW * dpr) || canvas.height !== Math.floor(cssH * dpr)) {
        canvas.width = Math.floor(cssW * dpr);
        canvas.height = Math.floor(cssH * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#0c0f14";
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.strokeStyle = "rgb(232 226 214 / 0.08)";
      ctx.lineWidth = 1;
      for (let g = 1; g < 4; g++) {
        ctx.beginPath();
        ctx.moveTo(0, (cssH * g) / 4);
        ctx.lineTo(cssW, (cssH * g) / 4);
        ctx.stroke();
      }
      const pts = shapedPoints(pointsRef.current, fromRef.current);
      const padX = 10;
      const padY = 12;
      const w = cssW - padX * 2;
      const h = cssH - padY * 2;
      const mid = padY + h;
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const x = padX + (i / (pts.length - 1)) * w;
        const y = padY + (1 - pts[i]!) * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineTo(padX + w, mid);
      ctx.lineTo(padX, mid);
      ctx.closePath();
      ctx.fillStyle = sh.on ? "rgb(201 137 58 / 0.22)" : "rgb(201 137 58 / 0.1)";
      ctx.fill();
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const x = padX + (i / (pts.length - 1)) * w;
        const y = padY + (1 - pts[i]!) * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = sh.on ? "#e8e2d6" : "#c9893a";
      ctx.lineWidth = 2.1;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();
      const phase = slot === 2 ? (engine?.shapePhase2 ?? 0) : (engine?.shapePhase ?? 0);
      if (sh.on && (engine?.voiceCount ?? 0) + (sh.mode === "loop" ? 1 : 0) > 0) {
        const px = padX + phase * w;
        ctx.strokeStyle = "rgb(201 137 58 / 0.85)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px, 6);
        ctx.lineTo(px, cssH - 6);
        ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [engine, sh.on, sh.mode, sh.from, slot]);

  return (
    <section className="lyra-cell lyra-shape">
      <h2 className="lyra-cell-title">Shape · draw LFO</h2>
      <div className="lyra-shape-body">
        <div className="lyra-shape-stage">
          <canvas
            ref={canvasRef}
            className="lyra-shape-canvas"
            aria-label="Draw modulation shape"
            onPointerDown={(e) => {
              drawing.current = true;
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                /* */
              }
              paint(e);
            }}
            onPointerMove={(e) => {
              if (drawing.current) paint(e);
            }}
            onPointerUp={() => {
              drawing.current = false;
            }}
            onPointerCancel={() => {
              drawing.current = false;
            }}
          />
          <div className="lyra-shape-presets">
            {SHAPE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={cn(sh.preset === p.id && "is-on")}
                onClick={() =>
                  setShape({
                    points: p.points(),
                    on: true,
                    preset: p.id,
                    ...(p.from != null ? { from: p.from } : {}),
                  })
                }
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <div className="lyra-shape-side">
          <Seg
            compact
            value={slot === 2 ? "2" : "1"}
            options={
              [
                { id: "1", label: "Sh 1", title: "Shape 1" },
                { id: "2", label: "Sh 2", title: "Shape 2 — independent curve" },
              ] as { id: "1" | "2"; label: string; title: string }[]
            }
            onChange={(id) => setSlot(id === "2" ? 2 : 1)}
          />
          <button type="button" className={cn("lyra-shape-arm", sh.on && "is-on")} onClick={() => setShape({ on: !sh.on })}>
            {sh.on ? "Armed" : "Arm shape"}
          </button>
          <Seg
            compact
            value={sh.mode}
            options={
              [
                { id: "env", label: "Env", title: "One-shot per note, like Serum Env mode" },
                { id: "loop", label: "Loop", title: "Repeats while notes are held" },
              ] as { id: ShapeMode; label: string; title: string }[]
            }
            onChange={(mode) => setShape({ mode })}
          />
          <div className="lyra-shape-dests">
            {DESTS.map((d) => (
              <button
                key={d.id}
                type="button"
                title={`${d.title} — click dest, Shift-click second dest`}
                className={cn(sh.dest === d.id && "is-on", sh.dest2 === d.id && "is-2")}
                onClick={(e) => {
                  if (e.shiftKey) setShape({ dest2: sh.dest2 === d.id ? "off" : d.id });
                  else setShape({ dest: d.id });
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div className="lyra-shape-knobs">
            <Knob
              label="Time"
              learnId="shape.time"
              value={sh.time}
              min={0.2}
              max={8}
              defaultValue={3}
              format={(v) => `${v.toFixed(1)}s`}
              onChange={(time) => setShape({ time })}
            />
            <Knob
              label="From"
              learnId="shape.from"
              value={sh.from}
              min={0}
              max={1}
              defaultValue={0.15}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(from) => setShape({ from })}
            />
            <Knob
              label="Depth"
              learnId="shape.depth"
              value={sh.depth}
              defaultValue={1}
              format={(v) => `${Math.round(v * 100)}`}
              onChange={(depth) => setShape({ depth })}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
