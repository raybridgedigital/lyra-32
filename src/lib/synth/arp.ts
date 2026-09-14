export type ArpStep = {
  on: boolean;
  accent: boolean;
  oct: -1 | 0 | 1;
};

export type StepKind = "rest" | "gate" | "accent" | "up" | "down";

export function defaultArpSteps(): ArpStep[] {
  return Array.from({ length: 16 }, (_, i) => ({ on: i % 2 === 0, accent: false, oct: 0 }));
}

export function normalizeArpSteps(raw: unknown): ArpStep[] {
  const base = defaultArpSteps();
  if (!Array.isArray(raw)) return base;
  return base.map((d, i) => {
    const s = raw[i] as Partial<ArpStep> | undefined;
    if (!s || typeof s !== "object") return d;
    const oct = s.oct === -1 || s.oct === 1 ? s.oct : 0;
    return { on: Boolean(s.on), accent: Boolean(s.accent), oct };
  });
}

export function stepKind(s: ArpStep): StepKind {
  if (!s.on) return "rest";
  if (s.oct === 1) return "up";
  if (s.oct === -1) return "down";
  if (s.accent) return "accent";
  return "gate";
}

export function cycleArpStep(s: ArpStep): ArpStep {
  switch (stepKind(s)) {
    case "rest":
      return { on: true, accent: false, oct: 0 };
    case "gate":
      return { on: true, accent: true, oct: 0 };
    case "accent":
      return { on: true, accent: false, oct: 1 };
    case "up":
      return { on: true, accent: false, oct: -1 };
    default:
      return { on: false, accent: false, oct: 0 };
  }
}

/** Compact factory notation: `.` rest, `x` gate, `X` accent, `u` +1 oct, `d` −1 oct. */
export function stepsFromCode(code: string): ArpStep[] {
  const steps: ArpStep[] = Array.from({ length: 16 }, () => ({ on: false, accent: false, oct: 0 }));
  const src = code.replace(/\s/g, "").slice(0, 16).padEnd(16, ".");
  for (let i = 0; i < 16; i++) {
    const c = src[i];
    if (c === "x") steps[i] = { on: true, accent: false, oct: 0 };
    else if (c === "X") steps[i] = { on: true, accent: true, oct: 0 };
    else if (c === "u") steps[i] = { on: true, accent: false, oct: 1 };
    else if (c === "d") steps[i] = { on: true, accent: false, oct: -1 };
    else steps[i] = { on: false, accent: false, oct: 0 };
  }
  return steps;
}
