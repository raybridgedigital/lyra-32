import { Power } from "lucide-react";
import { cn } from "@/lib/cn";
import type { LayerId, Patch } from "@/lib/synth/types";
import { midiName, waveLine } from "@/lib/synth/stack";
import { useSynth } from "@/lib/synth/store";

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
        <select
          aria-label={`Layer ${id.toUpperCase()} patch`}
          className="lyra-layer-name"
          value={empty ? "" : patch.id}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            const found = patches.find((x) => x.id === e.target.value);
            if (!found) return;
            selectLayer(id);
            loadPatch(found);
          }}
        >
          {id === "b" && (
            <option value="" disabled>
              — off —
            </option>
          )}
          {patches.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
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
