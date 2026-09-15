import { useEffect, useMemo, useRef, useState } from "react";
import { Power } from "lucide-react";
import { cn } from "@/lib/cn";
import type { LayerId, Patch } from "@/lib/synth/types";
import { midiName, waveLine } from "@/lib/synth/stack";
import { groupByCategory } from "@/lib/synth/patches";
import { useSynth } from "@/lib/synth/store";

function PatchMenu({
  id,
  patches,
  value,
  empty,
  onPick,
}: {
  id: LayerId;
  patches: Patch[];
  value: string;
  empty: boolean;
  onPick: (p: Patch | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const groups = useMemo(() => groupByCategory(patches), [patches]);
  const current = patches.find((x) => x.id === value);

  const place = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.min(r.left, window.innerWidth - 300);
    const top = r.bottom + 4;
    setPos({ top, left: Math.max(8, left) });
  };

  useEffect(() => {
    if (!open) return;
    place();
    const onDoc = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className={cn("lyra-patch-menu", open && "is-open")}>
      <button
        ref={btn}
        type="button"
        className="lyra-layer-name"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Layer ${id.toUpperCase()} patch`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        {empty ? "— off —" : current?.name ?? "Patch"}
      </button>
      {open ? (
        <div
          className="lyra-patch-pop"
          role="listbox"
          aria-label="Patches by category"
          style={{ top: pos.top, left: pos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {id === "b" ? (
            <button
              type="button"
              role="option"
              className="lyra-patch-item is-off"
              onClick={() => {
                onPick(null);
                setOpen(false);
              }}
            >
              — off —
            </button>
          ) : null}
          {groups.map((g) => (
            <div key={g.category} className="lyra-patch-group">
              <div className="lyra-patch-group-h">{g.category}</div>
              {g.patches.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  role="option"
                  aria-selected={x.id === value}
                  className={cn("lyra-patch-item", x.id === value && "is-on")}
                  onClick={() => {
                    onPick(x);
                    setOpen(false);
                  }}
                >
                  {x.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LayerCard({
  id,
  patches,
}: {
  id: LayerId;
  patches: Patch[];
}) {
  const selected = useSynth((s) => s.layer);
  const patch = useSynth((s) => (id === "a" ? s.layerA : s.layerB));
  const mix = useSynth((s) => (id === "a" ? s.mixA : s.mixB));
  const selectLayer = useSynth((s) => s.selectLayer);
  const setLayerOn = useSynth((s) => s.setLayerOn);
  const setLayerLevel = useSynth((s) => s.setLayerLevel);
  const setLayerPan = useSynth((s) => s.setLayerPan);
  const loadPatch = useSynth((s) => s.loadPatch);
  const empty = id === "b" && !mix.on;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => selectLayer(id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectLayer(id);
        }
      }}
      className={cn("lyra-layer-card", selected === id && "is-edit", mix.on && "is-on")}
      aria-pressed={selected === id}
      aria-label={`Layer ${id.toUpperCase()} ${patch.name}`}
    >
      <div className="lyra-layer-top">
        <span className="lyra-layer-id">{id.toUpperCase()}</span>
        <PatchMenu
          id={id}
          patches={patches}
          value={empty ? "" : patch.id}
          empty={empty}
          onPick={(found) => {
            if (!found) {
              if (id === "b") setLayerOn("b", false);
              return;
            }
            selectLayer(id);
            loadPatch(found);
          }}
        />
        <button
          type="button"
          className={cn("lyra-layer-power", mix.on && "is-on")}
          aria-label={mix.on ? `Mute layer ${id.toUpperCase()}` : `Enable layer ${id.toUpperCase()}`}
          aria-pressed={mix.on}
          onClick={(e) => {
            e.stopPropagation();
            setLayerOn(id, !mix.on);
          }}
        >
          <Power className="size-3.5" />
        </button>
      </div>
      <div className="lyra-layer-meta">
        {empty ? "pick a patch to stack" : `${waveLine(patch)} · ${patch.polyMode === "legato" ? "Leg" : patch.polyMode === "mono" ? "Mono" : "Poly"}`}
      </div>
      <div className="lyra-layer-faders" onClick={(e) => e.stopPropagation()}>
        <div className="lyra-layer-fader">
          <span className="lyra-layer-fader-k">Lvl</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={mix.level}
            aria-label={`Layer ${id.toUpperCase()} level`}
            onChange={(e) => setLayerLevel(id, Number(e.target.value))}
            onPointerUp={(e) => e.currentTarget.blur()}
          />
          <span className="lyra-layer-fader-v">{Math.round(mix.level * 100)}</span>
        </div>
        <div className="lyra-layer-fader">
          <button
            type="button"
            className="lyra-layer-fader-k"
            title="Reset pan to center"
            onClick={() => setLayerPan(id, 0)}
          >
            Pan
          </button>
          <input
            type="range"
            min={-1}
            max={1}
            step={0.01}
            value={mix.pan}
            aria-label={`Layer ${id.toUpperCase()} pan`}
            onChange={(e) => setLayerPan(id, Number(e.target.value))}
            onDoubleClick={() => setLayerPan(id, 0)}
            onPointerUp={(e) => e.currentTarget.blur()}
          />
          <button
            type="button"
            className="lyra-layer-fader-v"
            title="Reset pan to center"
            onClick={() => setLayerPan(id, 0)}
          >
            {Math.abs(mix.pan) < 0.04 ? "C" : mix.pan < 0 ? `L${Math.round(-mix.pan * 100)}` : `R${Math.round(mix.pan * 100)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export function LayerBrand() {
  return (
    <div className="lyra-layer-brand" aria-hidden>
      <img src="/lyra-layer-art.jpg" alt="" />
      <svg className="lyra-layer-brand-wave" viewBox="0 0 240 36" preserveAspectRatio="none">
        <path d="M0 18 C18 18 22 6 36 6 S54 30 72 30 90 6 108 6 126 30 144 30 162 6 180 6 198 30 216 30 228 18 240 18" />
      </svg>
      <div className="lyra-layer-brand-copy">
        <svg className="lyra-layer-lyre" viewBox="0 0 32 32" aria-hidden>
          <path d="M16 3.5c.6 3.2 1 6.6 1 10.2 0 4.2-.5 7.8-1.4 10.8" />
          <path d="M16 3.5c-.6 3.2-1 6.6-1 10.2 0 4.2.5 7.8 1.4 10.8" />
          <path d="M8.5 9.5c2.2 1.2 4.8 1.9 7.5 1.9s5.3-.7 7.5-1.9" />
          <path d="M7 14.5c2.6 1.5 5.7 2.3 9 2.3s6.4-.8 9-2.3" />
          <path d="M7.5 20c2.5 1.4 5.4 2.1 8.5 2.1s6-.7 8.5-2.1" />
          <circle cx="16" cy="4.2" r="1.15" fill="currentColor" stroke="none" />
          <path d="M11 26.5h10" />
        </svg>
        <div>
          <div className="lyra-layer-brand-mark">LYRA-32</div>
          <div className="lyra-layer-brand-by">
            <span>by</span> Ray Bridge Digital
          </div>
        </div>
      </div>
    </div>
  );
}

export function LayerStrip({ patches }: { patches: Patch[] }) {
  const mode = useSynth((s) => s.stackMode);
  const setStackMode = useSynth((s) => s.setStackMode);
  const splitNote = useSynth((s) => s.splitNote);
  const setSplitNote = useSynth((s) => s.setSplitNote);

  return (
    <section className="lyra-layers" aria-label="Layers">
      <LayerBrand />
      <LayerCard id="a" patches={patches} />
      <LayerCard id="b" patches={patches} />
      <div className="lyra-layer-tools">
        <div className="flex rounded-md bg-elevated p-0.5">
          <button
            type="button"
            className={cn("h-8 flex-1 rounded-sm px-2 text-sm font-semibold", mode === "stack" ? "bg-accent text-accent-fg" : "text-muted")}
            onClick={() => setStackMode("stack")}
          >
            Stack
          </button>
          <button
            type="button"
            className={cn("h-8 flex-1 rounded-sm px-2 text-sm font-semibold", mode === "split" ? "bg-accent text-accent-fg" : "text-muted")}
            onClick={() => setStackMode("split")}
          >
            Split
          </button>
        </div>
        <div className={cn("flex items-center justify-center gap-1", mode !== "split" && "opacity-40")}>
          <button type="button" className="grid size-8 place-items-center rounded-md bg-elevated text-sm font-semibold" onClick={() => setSplitNote(splitNote - 1)} aria-label="Split down">
            −
          </button>
          <span className="min-w-10 text-center font-mono text-sm font-semibold tabular-nums">{midiName(splitNote)}</span>
          <button type="button" className="grid size-8 place-items-center rounded-md bg-elevated text-sm font-semibold" onClick={() => setSplitNote(splitNote + 1)} aria-label="Split up">
            +
          </button>
        </div>
      </div>
    </section>
  );
}
