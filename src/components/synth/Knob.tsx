import { useRef } from "react";
import { cn } from "@/lib/cn";

type Props = {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  defaultValue?: number;
};

const CX = 24;
const CY = 24;
const R = 18;
const START_DEG = -135;
const SWEEP_DEG = 270;
const CIRC = 2 * Math.PI * R;
const ARC_LEN = (SWEEP_DEG / 360) * CIRC;
/** SVG circle strokes start at 3 o'clock; +135° lands that start at 7:30 (min). */
const TRACK_ROT = 135;

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function Knob({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.001,
  onChange,
  format,
  defaultValue,
}: Props) {
  const start = useRef<{ y: number; v: number } | null>(null);
  const safe = Number.isFinite(value) ? value : min;
  const span = max - min;
  const t = span === 0 ? 0 : clamp((safe - min) / span, 0, 1);
  const angle = START_DEG + t * SWEEP_DEG;

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* */
    }
    start.current = { y: e.clientY, v: safe };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!start.current) return;
    const fine = e.shiftKey ? 0.15 : 1;
    const dy = (start.current.y - e.clientY) * fine;
    const next = start.current.v + (dy / 110) * span;
    const snapped = Math.round(next / step) * step;
    onChange(clamp(snapped, min, max));
  };
  const onPointerUp = () => {
    start.current = null;
  };

  return (
    <div className="flex w-14 flex-col items-center gap-1 sm:w-16">
      <button
        type="button"
        aria-label={label}
        className={cn(
          "relative size-12 touch-none rounded-full bg-elevated shadow-knob outline-none sm:size-14",
          "focus-visible:ring-2 focus-visible:ring-accent/70",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => {
          if (defaultValue != null) onChange(defaultValue);
        }}
      >
        <svg viewBox="0 0 48 48" className="size-full">
          <circle
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="3"
            strokeLinecap="butt"
            strokeDasharray={`${ARC_LEN} ${CIRC}`}
            transform={`rotate(${TRACK_ROT} ${CX} ${CY})`}
          />
          <circle
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="3"
            strokeLinecap="butt"
            strokeDasharray={`${t * ARC_LEN} ${CIRC}`}
            transform={`rotate(${TRACK_ROT} ${CX} ${CY})`}
          />
          <g transform={`rotate(${Number.isFinite(angle) ? angle : START_DEG} ${CX} ${CY})`}>
            <line
              x1={CX}
              y1={CY}
              x2={CX}
              y2={CY - 11}
              stroke="var(--color-fg)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx={CX} cy={CY - R} r="2.4" fill="var(--color-accent)" />
          </g>
          <circle cx={CX} cy={CY} r="3" fill="var(--color-fg)" opacity="0.35" />
        </svg>
      </button>
      <div className="text-[0.625rem] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="font-mono text-[0.625rem] tabular-nums text-fg">
        {format ? format(value) : value.toFixed(2)}
      </div>
    </div>
  );
}

export function ModeRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[0.625rem] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={cn(
              "h-8 rounded-md px-2 text-[0.6875rem] font-medium transition-colors duration-(--motion-quick)",
              o.id === value ? "bg-accent text-accent-fg" : "bg-elevated text-muted hover:text-fg",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
