import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { useSynth } from "@/lib/synth/store";

const WHITE = [0, 2, 4, 5, 7, 9, 11];

function isBlack(pc: number) {
  return ![0, 2, 4, 5, 7, 9, 11].includes(pc);
}

export function Keyboard() {
  const octave = useSynth((s) => s.octave);
  const active = useSynth((s) => s.activeNotes);
  const noteOn = useSynth((s) => s.noteOn);
  const noteOff = useSynth((s) => s.noteOff);

  const start = 36 + octave * 12;
  const keys = useMemo(() => Array.from({ length: 25 }, (_, i) => start + i), [start]);
  const whites = keys.filter((n) => WHITE.includes(n % 12));

  const press = (midi: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* synthetic / lost pointer */
    }
    noteOn(midi, 0.9);
  };
  const release = (midi: number) => () => noteOff(midi);

  return (
    <div className="relative h-16 w-full overflow-hidden rounded-lg bg-elevated">
      <div className="absolute inset-0 flex">
        {whites.map((midi) => {
          const on = active.includes(midi);
          return (
            <button
              key={midi}
              type="button"
              aria-label={`Note ${midi}`}
              className={cn(
                "relative h-full min-w-0 flex-1 touch-none border-r border-bg last:border-r-0",
                on ? "bg-accent" : "bg-key hover:bg-key-hover",
              )}
              onPointerDown={press(midi)}
              onPointerUp={release(midi)}
              onPointerCancel={release(midi)}
            />
          );
        })}
      </div>
      <div className="pointer-events-none absolute inset-0 flex">
        {whites.map((midi, i) => {
          const nextBlack = midi + 1;
          const hasBlack = isBlack(nextBlack % 12) && keys.includes(nextBlack);
          if (!hasBlack) return <div key={midi} className="relative min-w-0 flex-1" />;
          const on = active.includes(nextBlack);
          return (
            <div key={midi} className="relative min-w-0 flex-1">
              <button
                type="button"
                aria-label={`Note ${nextBlack}`}
                className={cn(
                  "pointer-events-auto absolute top-0 z-10 h-[58%] w-[62%] -translate-x-1/2 touch-none rounded-b-sm",
                  on ? "bg-accent" : "bg-ink hover:bg-ink-soft",
                )}
                style={{ left: "100%" }}
                onPointerDown={press(nextBlack)}
                onPointerUp={release(nextBlack)}
                onPointerCancel={release(nextBlack)}
              />
              <span className="sr-only">{i}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
