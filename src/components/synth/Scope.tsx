import { useEffect, useMemo, useRef } from "react";
import { useSynth } from "@/lib/synth/store";
import { shapeFromOsc, wtCycle } from "@/lib/synth/wavetable";
import { cn } from "@/lib/cn";
import type { Waveform } from "@/lib/synth/types";

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

function analogCycle(wave: Waveform, pwm: number) {
  const n = 256;
  const out = new Float32Array(n);
  const d = Math.min(0.92, Math.max(0.08, pwm));
  for (let i = 0; i < n; i++) {
    const t = i / n;
    if (wave === "sine") out[i] = Math.sin(t * Math.PI * 2);
    else if (wave === "triangle") out[i] = 1 - 4 * Math.abs(t - 0.5);
    else if (wave === "sawtooth" || wave === "supersaw") out[i] = t * 2 - 1;
    else if (wave === "square") out[i] = t < 0.5 ? 1 : -1;
    else if (wave === "pulse") out[i] = t < d ? 1 : -1;
    else out[i] = Math.sin(t * Math.PI * 2);
  }
  return out;
}

export function Scope({ compact = false }: { compact?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engine = useSynth((s) => s.engine);
  const voices = useSynth((s) => s.voices);
  const activeNotes = useSynth((s) => s.activeNotes);
  const osc1 = useSynth((s) => s.patch.osc1);
  const gainRef = useRef(1);

  const rest = useMemo(
    () => (osc1.wave === "wt" ? wtCycle(osc1.table, osc1.pwm, shapeFromOsc(osc1)) : analogCycle(osc1.wave, osc1.pwm)),
    [osc1],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const analyser = engine?.analyser;
    const data = new Float32Array(analyser?.fftSize ?? 4096);
    let raf = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const draw = () => {
      const cssW = canvas.clientWidth || (compact ? 220 : 640);
      const cssH = canvas.clientHeight || (compact ? 36 : 80);
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
      ctx.beginPath();
      ctx.moveTo(4, cssH / 2);
      ctx.lineTo(cssW - 4, cssH / 2);
      ctx.stroke();

      const padX = compact ? 4 : 8;
      const padY = compact ? 3 : 8;
      const w = cssW - padX * 2;
      const h = cssH - padY * 2;
      const mid = padY + h / 2;
      const live = Boolean(analyser && voices > 0);
      let src = rest;
      let start = 0;
      let span = rest.length;
      let amp = 1;

      if (live && analyser) {
        analyser.getFloatTimeDomainData(data);
        const sr = analyser.context.sampleRate;
        const midi = activeNotes[0] ?? 60;
        const hz = 440 * Math.pow(2, (midi - 69) / 12);
        const period = Math.max(32, sr / Math.max(20, hz));
        span = Math.min(data.length - 8, period * 2);
        start = findTrigger(data, period);
        let peak = 0.04;
        for (let i = 0; i < 128; i++) {
          peak = Math.max(peak, Math.abs(data[Math.min(data.length - 1, start + Math.floor((i / 128) * span))]!));
        }
        gainRef.current += (0.9 / peak - gainRef.current) * 0.14;
        amp = gainRef.current;
        src = data;
      } else {
        gainRef.current += (1 - gainRef.current) * 0.2;
        amp = 1;
      }

      const yAt = (x: number) => {
        if (live && analyser) {
          const t = start + (x / w) * (span - 1);
          return mid - sampleAt(src, t) * amp * h * 0.46;
        }
        const t = ((x / w) * src.length * 2) % src.length;
        return mid - sampleAt(src, t) * amp * h * 0.46;
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
      ctx.fillStyle = live ? "rgb(201 137 58 / 0.28)" : "rgb(201 137 58 / 0.16)";
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
      ctx.shadowColor = live ? "rgb(201 137 58 / 0.6)" : "rgb(201 137 58 / 0.25)";
      ctx.shadowBlur = compact ? 6 : 10;
      ctx.lineWidth = compact ? 1.6 : 2.1;
      ctx.stroke();
      ctx.shadowBlur = 0;

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [engine, compact, voices, activeNotes, rest]);

  return (
    <canvas
      ref={canvasRef}
      width={compact ? 220 : 640}
      height={compact ? 36 : 80}
      className={cn("w-full rounded-md bg-ink", compact ? "h-9" : "h-16")}
      aria-hidden
    />
  );
}
