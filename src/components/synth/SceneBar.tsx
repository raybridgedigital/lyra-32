import { cn } from "@/lib/cn";
import { useSynth } from "@/lib/synth/store";
import { SCENE_N } from "@/lib/synth/scenes";

export function SceneBar() {
  const scenes = useSynth((s) => s.scenes);
  const active = useSynth((s) => s.activeScene);
  const saveScene = useSynth((s) => s.saveScene);
  const recallScene = useSynth((s) => s.recallScene);
  const clearScene = useSynth((s) => s.clearScene);

  return (
    <div className="lyra-scenes" role="group" aria-label="Scenes">
      <span className="lyra-scenes-label">Scenes</span>
      {Array.from({ length: SCENE_N }, (_, i) => {
        const filled = Boolean(scenes[i]);
        return (
          <button
            key={i}
            type="button"
            className={cn("lyra-scene", filled && "is-filled", active === i && "is-on")}
            title={
              filled
                ? `Scene ${i + 1} — click to recall, Shift-click to overwrite, Alt-click to clear`
                : `Scene ${i + 1} empty — click to store this sound`
            }
            onClick={(e) => {
              if (e.altKey || e.metaKey) {
                clearScene(i);
                return;
              }
              if (e.shiftKey || !filled) saveScene(i);
              else recallScene(i);
            }}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}
