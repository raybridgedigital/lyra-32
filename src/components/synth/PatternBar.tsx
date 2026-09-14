import { cn } from "@/lib/cn";
import { cycleArpStep, defaultArpSteps, stepKind, type ArpStep } from "@/lib/synth/arp";
import type { Patch } from "@/lib/synth/types";
import { clonePatch } from "@/lib/synth/patches";

const KIND_LABEL: Record<string, string> = {
  rest: "rest",
  gate: "gate",
  accent: "accent",
  up: "+1 oct",
  down: "−1 oct",
};

export function PatternBar({
  patch,
  playhead,
  onChange,
}: {
  patch: Patch;
  playhead: number;
  onChange: (next: Patch) => void;
}) {
  const steps = patch.arp.steps?.length === 16 ? patch.arp.steps : defaultArpSteps();
  const armed = patch.arp.on && patch.arp.pattern;

  const setStep = (i: number, step: ArpStep) => {
    const next = steps.slice();
    next[i] = step;
    onChange(clonePatch(patch, { arp: { ...patch.arp, steps: next } }));
  };

  return (
    <section className="lyra-seq" aria-label="Arp pattern">
      <button
        type="button"
        className={cn("lyra-seq-toggle", patch.arp.pattern && "is-on")}
        onClick={() => {
          const pattern = !patch.arp.pattern;
          onChange(
            clonePatch(patch, {
              arp: { ...patch.arp, pattern, on: pattern ? true : patch.arp.on },
            }),
          );
        }}
      >
        Pattern
      </button>
      <div className="lyra-steps">
        {steps.map((st, i) => {
          const kind = stepKind(st);
          const beat = i % 4 === 0;
          const live = armed && playhead === i;
          const mark = kind === "up" ? "+1" : kind === "down" ? "−1" : kind === "accent" ? "•" : "";
          return (
            <button
              key={i}
              type="button"
              title={`Step ${i + 1}: ${KIND_LABEL[kind]}. Click to cycle.`}
              aria-label={`Step ${i + 1} ${KIND_LABEL[kind]}`}
              aria-pressed={st.on}
              className={cn(
                "lyra-step",
                `is-${kind}`,
                beat && "is-beat",
                live && "is-live",
              )}
              onClick={() => setStep(i, cycleArpStep(st))}
            >
              <span className="lyra-step-n">{beat ? i + 1 : ""}</span>
              <span className="lyra-step-mark">{mark}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
