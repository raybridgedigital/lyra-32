import { useRef } from "react";
import { cn } from "@/lib/cn";
import { clonePatch } from "@/lib/synth/patches";
import { useSynth } from "@/lib/synth/store";

export function XyPad() {
  const patch = useSynth((s) => s.patch);
  const setPatch = useSynth((s) => s.setPatch);
  const dragging = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const x = patch.filter.cutoff;
  const y = patch.filter.resonance;

  const at = (ev: React.PointerEvent) => {
    const r = root.current?.getBoundingClientRect();
    if (!r) return;
    const nx = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
    const ny = Math.max(0, Math.min(1, 1 - (ev.clientY - r.top) / r.height));
    setPatch(clonePatch(patch, { filter: { ...patch.filter, cutoff: nx, resonance: ny } }));
  };

  return (
    <div className="lyra-xy" aria-label="XY pad Cut × Res">
      <span className="lyra-xy-lab">XY · Cut / Res</span>
      <div
        ref={root}
        className={cn("lyra-xy-pad")}
        onPointerDown={(e) => {
          dragging.current = true;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* */
          }
          at(e);
        }}
        onPointerMove={(e) => {
          if (dragging.current) at(e);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
      >
        <i style={{ left: `${x * 100}%`, bottom: `${y * 100}%` }} />
      </div>
    </div>
  );
}
