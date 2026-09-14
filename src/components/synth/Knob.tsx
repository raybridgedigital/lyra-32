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
  const readout = format ? format(safe) : safe.toFixed(2);

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
    const next = start.current.v + (dy / 90) * span;
    const snapped = Math.round(next / step) * step;
    onChange(clamp(snapped, min, max));
  };
  const onPointerUp = () => {
    start.current = null;
  };

  return (
    <div className="flex min-w-0 flex-col items-center gap-1">
      <button
        type="button"
        aria-label={`${label} ${readout}`}
        title={`${label} ${readout}`}
        className={cn(
          "lyra-knob relative touch-none rounded-full bg-elevated shadow-knob outline-none",
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
        </svg>
      </button>
      <div className="flex max-w-full items-baseline justify-center gap-1 px-0.5">
        <span className="truncate text-sm font-semibold uppercase tracking-wide text-muted">{label}</span>
        <span className="shrink-0 font-mono text-sm tabular-nums text-fg">{readout}</span>
      </div>
    </div>
  );
}

export function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
  compact,
}: {
  value: T;
  options: { id: T; label: string; title?: string }[];
  onChange: (v: T) => void;
  label?: string;
  compact?: boolean;
}) {
  return (
    <div className="min-w-0 shrink-0">
      {label ? <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{label}</div> : null}
      <div className="flex min-w-0 rounded-md bg-elevated p-0.5">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            title={o.title ?? o.label}
            className={cn(
              "min-w-0 flex-1 truncate rounded-sm px-1 font-semibold transition-colors duration-(--motion-quick)",
              compact ? "h-8 text-sm" : "h-11 text-base",
              o.id === value ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ModeRow<T extends string>(props: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return <Seg {...props} />;
}

export function AmtFader({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex min-w-0 flex-1 items-center gap-2">
      <input
        type="range"
        min={-1}
        max={1}
        step={0.01}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="lyra-fader min-w-0 flex-1 cursor-pointer"
      />
      <span className="w-10 shrink-0 text-right font-mono text-sm tabular-nums text-fg">{Math.round(value * 100)}</span>
    </label>
  );
}
