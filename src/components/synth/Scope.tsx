import { useEffect, useRef } from "react";
import { useSynth } from "@/lib/synth/store";

export function Scope() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engine = useSynth((s) => s.engine);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !engine) return;
    const ctx2 = canvas.getContext("2d");
    if (!ctx2) return;
    const analyser = engine.analyser;
    const data = new Uint8Array(analyser.fftSize);
    let raf = 0;
    const draw = () => {
      analyser.getByteTimeDomainData(data);
      const { width, height } = canvas;
      ctx2.clearRect(0, 0, width, height);
      ctx2.fillStyle = getComputedStyle(canvas).getPropertyValue("--color-ink-soft") || "#141820";
      ctx2.fillRect(0, 0, width, height);
      ctx2.strokeStyle = getComputedStyle(canvas).getPropertyValue("--color-accent") || "#c9893a";
      ctx2.lineWidth = 1.5;
      ctx2.beginPath();
      const step = data.length / width;
      for (let x = 0; x < width; x++) {
        const v = data[Math.floor(x * step)]! / 128 - 1;
        const y = height / 2 + v * height * 0.42;
        if (x === 0) ctx2.moveTo(x, y);
        else ctx2.lineTo(x, y);
      }
      ctx2.stroke();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={120}
      className="h-24 w-full rounded-lg bg-ink-soft sm:h-28"
      aria-hidden
    />
  );
}
