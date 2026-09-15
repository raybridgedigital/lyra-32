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
  /** Clickable name: bypasses to 0 (or armOff) and restores the last amount. */
  arm?: boolean;
  /** Display-only overlay (e.g. live cutoff from mod wheel). Does not write the patch. */
  liveValue?: number;
  armOff?: number;
  armOn?: number;
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

function useArm(value: number, onChange: (v: number) => void, off: number, fallback: number) {
  const last = useRef(Math.abs(value - off) > 0.012 ? value : fallback);
  if (Math.abs(value - off) > 0.012) last.current = value;
  const on = Math.abs(value - off) > 0.012;
  return {
    on,
    toggle: () => onChange(on ? off : last.current),
  };
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
  arm,
  armOff,
  armOn,
  liveValue,
}: Props) {
  const start = useRef<{ y: number; v: number } | null>(null);
  const safe = Number.isFinite(value) ? value : min;
  const span = max - min;
  const t = span === 0 ? 0 : clamp((safe - min) / span, 0, 1);
  const angle = START_DEG + t * SWEEP_DEG;
  const liveSafe = liveValue != null && Number.isFinite(liveValue) ? liveValue : null;
  const liveT = liveSafe == null ? null : span === 0 ? 0 : clamp((liveSafe - min) / span, 0, 1);
  const liveAngle = liveT == null ? null : START_DEG + liveT * SWEEP_DEG;
  const liveDelta = liveT != null && Math.abs(liveT - t) > 0.008;
  const readout = format ? format(safe) : safe.toFixed(2);
  const off = armOff ?? min;
  const armed = useArm(safe, onChange, off, armOn ?? (defaultValue != null && defaultValue !== off ? defaultValue : min + span * 0.35));

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
    <div className={cn("flex min-w-0 flex-col items-center gap-1", arm && !armed.on && "opacity-55")}>
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
          {liveDelta && liveAngle != null ? (
            <g transform={`rotate(${liveAngle} ${CX} ${CY})`}>
              <line
                x1={CX}
                y1={CY}
                x2={CX}
                y2={CY - 13}
                stroke="#e8c078"
                strokeWidth="1.6"
                strokeLinecap="round"
                opacity="0.95"
              />
              <circle cx={CX} cy={CY - R} r="2.1" fill="#e8c078" />
            </g>
          ) : null}
        </svg>
      </button>
      <div className="flex max-w-full items-baseline justify-center gap-1 px-0.5">
        {arm ? (
          <button
            type="button"
            className={cn("lyra-arm", armed.on && "is-on")}
            aria-pressed={armed.on}
            aria-label={`${label} ${armed.on ? "on" : "off"}`}
            title={`${label} ${armed.on ? "on — click to bypass" : "off — click to restore"}`}
            onClick={armed.toggle}
          >
            {label}
          </button>
        ) : (
          <span className="truncate text-sm font-semibold uppercase tracking-wide text-muted">{label}</span>
        )}
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
  const armed = useArm(value, onChange, 0, 0.35);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <button
        type="button"
        className={cn("lyra-arm shrink-0", armed.on && "is-on")}
        aria-pressed={armed.on}
        aria-label={`${label} ${armed.on ? "on" : "off"}`}
        title={armed.on ? "Bypass this route" : "Enable this route"}
        onClick={armed.toggle}
      >
        {label}
      </button>
      <input
        type="range"
        min={-1}
        max={1}
        step={0.01}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="lyra-fader min-w-0 flex-1 cursor-pointer"
        onPointerUp={(e) => e.currentTarget.blur()}
      />
      <span className="w-10 shrink-0 text-right font-mono text-sm tabular-nums text-fg">{Math.round(value * 100)}</span>
    </div>
  );
}

export function LfoSlider({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.001,
  format,
  onChange,
  arm,
  armOn = 0.25,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  arm?: boolean;
  armOn?: number;
}) {
  const n = typeof value === "number" && Number.isFinite(value) ? value : min;
  const span = max - min || 1;
  const t = clamp((n - min) / span, 0, 1);
  const armed = useArm(n, onChange, min, armOn);
  return (
    <>
      {arm ? (
        <button
          type="button"
          className={cn("lyra-arm lyra-lfo-label justify-self-start", armed.on && "is-on")}
          aria-pressed={armed.on}
          aria-label={`${label} ${armed.on ? "on" : "off"}`}
          title={`${label} ${armed.on ? "on — click to bypass" : "off — click to restore"}`}
          onClick={armed.toggle}
        >
          {label}
        </button>
      ) : (
        <span className="lyra-lfo-label">{label}</span>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={n}
        aria-label={label}
        className="lyra-fader lyra-lfo-fader min-w-0 cursor-pointer"
        style={{ ["--fill" as string]: `${(t * 100).toFixed(1)}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={(e) => e.currentTarget.blur()}
      />
      <span className="lyra-lfo-readout">{format(n)}</span>
    </>
  );
}
