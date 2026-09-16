import { useState } from "react";
import { cn } from "@/lib/cn";
import { useSynth } from "@/lib/synth/store";
import { SCENE_N } from "@/lib/synth/scenes";
import { XyPad } from "./XyPad";

export function SceneBar() {
  const scenes = useSynth((s) => s.scenes);
  const active = useSynth((s) => s.activeScene);
  const saveScene = useSynth((s) => s.saveScene);
  const recallScene = useSynth((s) => s.recallScene);
  const clearScene = useSynth((s) => s.clearScene);
  const renameScene = useSynth((s) => s.renameScene);
  const storeAb = useSynth((s) => s.storeAb);
  const toggleAb = useSynth((s) => s.toggleAb);
  const abOn = useSynth((s) => s.abOn);
  const abSnap = useSynth((s) => s.abSnap);
  const morphFrom = useSynth((s) => s.morphFrom);
  const morphTo = useSynth((s) => s.morphTo);
  const morphAmt = useSynth((s) => s.morphAmt);
  const setMorph = useSynth((s) => s.setMorph);
  const [edit, setEdit] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  return (
    <div className="lyra-scenes" role="group" aria-label="Scenes">
      <span className="lyra-scenes-label">Scenes</span>
      {Array.from({ length: SCENE_N }, (_, i) => {
        const filled = Boolean(scenes[i]);
        const label = scenes[i]?.name || String(i + 1);
        return (
          <button
            key={i}
            type="button"
            className={cn("lyra-scene", filled && "is-filled", active === i && "is-on")}
            title={
              filled
                ? `${label} — click recall, Shift overwrite, Option or right-click clear, double-click rename`
                : `Scene ${i + 1} empty — click to store`
            }
            onDoubleClick={(e) => {
              e.preventDefault();
              if (!filled) return;
              setEdit(i);
              setDraft(scenes[i]?.name ?? `S${i + 1}`);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              if (filled) clearScene(i);
            }}
            onClick={(e) => {
              if (edit != null) return;
              if (e.altKey || e.metaKey || e.ctrlKey) {
                clearScene(i);
                return;
              }
              if (e.shiftKey || !filled) saveScene(i);
              else recallScene(i);
            }}
          >
            {edit === i ? (
              <input
                autoFocus
                className="lyra-scene-input"
                value={draft}
                maxLength={10}
                onChange={(e) => setDraft(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onBlur={() => {
                  renameScene(i, draft);
                  setEdit(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    renameScene(i, draft);
                    setEdit(null);
                  }
                  if (e.key === "Escape") setEdit(null);
                }}
              />
            ) : (
              <span className="lyra-scene-name">{label}</span>
            )}
          </button>
        );
      })}
      <button
        type="button"
        className={cn("lyra-scene-act", abSnap && "is-on")}
        title="Store this sound as A/B compare B"
        onClick={() => storeAb()}
      >
        Store
      </button>
      <button
        type="button"
        className={cn("lyra-scene-act", abOn && "is-on")}
        title="A/B — hear stored vs now"
        disabled={!abSnap && !abOn}
        onClick={() => toggleAb()}
      >
        A/B
      </button>
      <div className="lyra-morph">
        <select
          aria-label="Morph from"
          value={morphFrom}
          onChange={(e) => setMorph(Number(e.target.value), morphTo, morphAmt)}
        >
          {Array.from({ length: SCENE_N }, (_, i) => (
            <option key={i} value={i} disabled={!scenes[i]}>
              {scenes[i]?.name || i + 1}
            </option>
          ))}
        </select>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={morphAmt}
          aria-label="Morph scenes"
          title="Morph two scenes"
          onChange={(e) => setMorph(morphFrom, morphTo, Number(e.target.value))}
        />
        <select
          aria-label="Morph to"
          value={morphTo}
          onChange={(e) => setMorph(morphFrom, Number(e.target.value), morphAmt)}
        >
          {Array.from({ length: SCENE_N }, (_, i) => (
            <option key={i} value={i} disabled={!scenes[i]}>
              {scenes[i]?.name || i + 1}
            </option>
          ))}
        </select>
      </div>
      <XyPad />
    </div>
  );
}
