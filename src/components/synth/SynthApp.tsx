import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Keyboard as KeyboardIcon,
  Save,
  Trash2,
  Volume2,
  VolumeX,
  Usb,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { clonePatch, groupByCategory } from "@/lib/synth/patches";
import { bindAudioUnlock, bindComputerKeyboard, useSynth } from "@/lib/synth/store";
import type {
  ArpMode,
  ArpRate,
  FilterSlope,
  FilterType,
  LfoDest,
  LfoWave,
  Patch,
  PolyMode,
  Waveform,
} from "@/lib/synth/types";
import { Keyboard } from "./Keyboard";
import { Knob, ModeRow } from "./Knob";
import { Scope } from "./Scope";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-surface p-3 sm:p-4">
      <h2 className="mb-3 font-display text-xs font-semibold uppercase tracking-[0.16em] text-muted">{title}</h2>
      {children}
    </section>
  );
}

function fmtHz(v: number) {
  const hz = 20 * Math.pow(1000, v);
  return hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : `${Math.round(hz)}`;
}
function fmtMs(v: number) {
  return v < 1 ? `${Math.round(v * 1000)}ms` : `${v.toFixed(2)}s`;
}
function fmtPct(v: number) {
  return `${Math.round(v * 100)}`;
}

const WAVES: { id: Waveform; label: string }[] = [
  { id: "sine", label: "Sin" },
  { id: "triangle", label: "Tri" },
  { id: "sawtooth", label: "Saw" },
  { id: "square", label: "Sqr" },
  { id: "pulse", label: "Pulse" },
  { id: "supersaw", label: "Stack" },
];

export function SynthApp() {
  const armed = useSynth((s) => s.armed);
  const ctxState = useSynth((s) => s.ctxState);
  const patch = useSynth((s) => s.patch);
  const setPatch = useSynth((s) => s.setPatch);
  const loadPatch = useSynth((s) => s.loadPatch);
  const factory = useSynth((s) => s.factory);
  const userPatches = useSynth((s) => s.userPatches);
  const saveUserPatch = useSynth((s) => s.saveUserPatch);
  const deleteUserPatch = useSynth((s) => s.deleteUserPatch);
  const midiStatus = useSynth((s) => s.midiStatus);
  const midiName = useSynth((s) => s.midiName);
  const voices = useSynth((s) => s.voices);
  const octave = useSynth((s) => s.octave);
  const shiftOctave = useSynth((s) => s.shiftOctave);
  const panic = useSynth((s) => s.panic);
  const mute = useSynth((s) => s.masterMute);
  const toggleMute = useSynth((s) => s.toggleMute);
  const noteOn = useSynth((s) => s.noteOn);
  const noteOff = useSynth((s) => s.noteOff);
  const engine = useSynth((s) => s.engine);
  const [nameDraft, setNameDraft] = useState("");
  const [libCat, setLibCat] = useState("All");
  const [libQ, setLibQ] = useState("");

  useEffect(() => {
    useSynth.getState().hydrate();
  }, []);

  useEffect(() => {
    const unkey = bindComputerKeyboard();
    const unlock = bindAudioUnlock();
    return () => {
      unkey();
      unlock();
    };
  }, []);

  const allPatches = useMemo(() => [...factory, ...userPatches], [factory, userPatches]);
  const factoryGroups = useMemo(() => groupByCategory(factory), [factory]);
  const filteredFactory = useMemo(() => {
    const q = libQ.trim().toLowerCase();
    return factory.filter((x) => {
      if (libCat !== "All" && x.category !== libCat) return false;
      if (!q) return true;
      return x.name.toLowerCase().includes(q) || x.category.toLowerCase().includes(q);
    });
  }, [factory, libCat, libQ]);

  const update = (next: Patch) => setPatch(next);
  const p = patch;
  const live = ctxState === "running";

  const stepPatch = (dir: number) => {
    if (!allPatches.length) return;
    const i = allPatches.findIndex((x) => x.id === p.id);
    const idx = i < 0 ? 0 : (i + dir + allPatches.length) % allPatches.length;
    const next = allPatches[idx];
    if (next) loadPatch(next);
  };

  return (
    <div className="min-h-dvh overflow-x-hidden bg-bg pb-52 text-fg" data-audio={ctxState}>
      <header className="sticky top-0 z-20 border-b border-border bg-bg/90 px-3 py-3 backdrop-blur-sm sm:px-5">
        <div className="mx-auto flex max-w-6xl flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-display text-[0.65rem] uppercase tracking-[0.2em] text-accent">LYRA-32</div>
              <div className="truncate font-display text-lg font-semibold tracking-tight">{p.name}</div>
            </div>
            <div
              className={cn(
                "hidden h-11 items-center rounded-lg px-3 text-xs font-medium sm:flex",
                live ? "bg-elevated text-accent" : "bg-elevated text-muted",
              )}
            >
              {live ? "Sound on" : "Press a key"}
            </div>
            <MidiBadge status={midiStatus} name={midiName} />
            <div className="flex items-center gap-1 font-mono text-xs tabular-nums text-muted">
              <Activity className="size-3.5" />
              <span>{voices}</span>
            </div>
            <button
              type="button"
              onClick={toggleMute}
              className="grid size-11 place-items-center rounded-lg bg-elevated text-fg"
              aria-label={mute ? "Unmute" : "Mute"}
            >
              {mute ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
            <button
              type="button"
              onClick={panic}
              className="h-11 rounded-lg bg-elevated px-3 text-xs font-medium text-muted hover:text-fg"
            >
              Panic
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous patch"
              className="grid size-11 shrink-0 place-items-center rounded-lg bg-elevated text-fg"
              onClick={() => stepPatch(-1)}
            >
              <ChevronLeft className="size-4" />
            </button>
            <select
              aria-label="Load patch"
              className="h-11 min-w-0 flex-1 rounded-lg bg-elevated px-3 text-sm text-fg"
              value={p.id}
              onChange={(e) => {
                const found = allPatches.find((x) => x.id === e.target.value);
                if (found) loadPatch(found);
              }}
            >
              {factoryGroups.map((g) => (
                <optgroup key={g.category} label={`${g.category} (${g.patches.length})`}>
                  {g.patches.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </optgroup>
              ))}
              {userPatches.length > 0 && (
                <optgroup label={`User (${userPatches.length})`}>
                  {userPatches.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <button
              type="button"
              aria-label="Next patch"
              className="grid size-11 shrink-0 place-items-center rounded-lg bg-elevated text-fg"
              onClick={() => stepPatch(1)}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-3 p-3 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-2">
          <Panel title="Oscillator 1">
            <ModeRow
              label="Wave"
              value={p.osc1.wave}
              options={WAVES}
              onChange={(wave) => update(clonePatch(p, { osc1: { ...p.osc1, wave } }))}
            />
            <div className="mt-3 flex flex-wrap justify-between gap-2">
              <Knob
                label="Oct"
                value={p.osc1.octave}
                min={-2}
                max={2}
                step={1}
                defaultValue={0}
                format={(v) => `${v >= 0 ? "+" : ""}${v}`}
                onChange={(octave) => update(clonePatch(p, { osc1: { ...p.osc1, octave } }))}
              />
              <Knob
                label="Fine"
                value={p.osc1.fine}
                min={-50}
                max={50}
                step={1}
                defaultValue={0}
                format={(v) => `${v}c`}
                onChange={(fine) => update(clonePatch(p, { osc1: { ...p.osc1, fine } }))}
              />
              <Knob
                label="Level"
                value={p.osc1.level}
                defaultValue={0.8}
                format={fmtPct}
                onChange={(level) => update(clonePatch(p, { osc1: { ...p.osc1, level } }))}
              />
              <Knob
                label="PWM"
                value={p.osc1.pwm}
                defaultValue={0.5}
                format={fmtPct}
                onChange={(pwm) => update(clonePatch(p, { osc1: { ...p.osc1, pwm } }))}
              />
            </div>
          </Panel>
          <Panel title="Oscillator 2">
            <ModeRow
              label="Wave"
              value={p.osc2.wave}
              options={WAVES}
              onChange={(wave) => update(clonePatch(p, { osc2: { ...p.osc2, wave } }))}
            />
            <div className="mt-3 flex flex-wrap justify-between gap-2">
              <Knob
                label="Oct"
                value={p.osc2.octave}
                min={-2}
                max={2}
                step={1}
                defaultValue={0}
                format={(v) => `${v >= 0 ? "+" : ""}${v}`}
                onChange={(octave) => update(clonePatch(p, { osc2: { ...p.osc2, octave } }))}
              />
              <Knob
                label="Fine"
                value={p.osc2.fine}
                min={-50}
                max={50}
                step={1}
                defaultValue={7}
                format={(v) => `${v}c`}
                onChange={(fine) => update(clonePatch(p, { osc2: { ...p.osc2, fine } }))}
              />
              <Knob
                label="Level"
                value={p.osc2.level}
                defaultValue={0.7}
                format={fmtPct}
                onChange={(level) => update(clonePatch(p, { osc2: { ...p.osc2, level } }))}
              />
              <Knob
                label="FM"
                value={p.fmIndex}
                defaultValue={0}
                format={fmtPct}
                onChange={(fmIndex) => update(clonePatch(p, { fmIndex }))}
              />
            </div>
          </Panel>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Panel title="Mixer">
            <div className="flex flex-wrap justify-between gap-2">
              <Knob label="Sub" value={p.subLevel} format={fmtPct} onChange={(subLevel) => update(clonePatch(p, { subLevel }))} />
              <Knob
                label="Noise"
                value={p.noiseLevel}
                format={fmtPct}
                onChange={(noiseLevel) => update(clonePatch(p, { noiseLevel }))}
              />
              <Knob label="Drive" value={p.drive} format={fmtPct} onChange={(drive) => update(clonePatch(p, { drive }))} />
              <Knob
                label="Glide"
                value={p.glide}
                format={fmtPct}
                onChange={(glide) => update(clonePatch(p, { glide }))}
              />
            </div>
            <div className="mt-3">
              <ModeRow
                label="Voice"
                value={p.polyMode}
                options={
                  [
                    { id: "poly", label: "Poly" },
                    { id: "mono", label: "Mono" },
                    { id: "legato", label: "Legato" },
                  ] as { id: PolyMode; label: string }[]
                }
                onChange={(polyMode) => update(clonePatch(p, { polyMode }))}
              />
            </div>
          </Panel>

          <Panel title="Filter">
            <ModeRow
              label="Type"
              value={p.filter.type}
              options={
                [
                  { id: "lowpass", label: "LP" },
                  { id: "highpass", label: "HP" },
                  { id: "bandpass", label: "BP" },
                ] as { id: FilterType; label: string }[]
              }
              onChange={(type) => update(clonePatch(p, { filter: { ...p.filter, type } }))}
            />
            <div className="mt-2">
              <ModeRow
                label="Slope"
                value={String(p.filter.slope) as "12" | "24"}
                options={[
                  { id: "12", label: "12 dB" },
                  { id: "24", label: "24 dB" },
                ]}
                onChange={(s) =>
                  update(clonePatch(p, { filter: { ...p.filter, slope: Number(s) as FilterSlope } }))
                }
              />
            </div>
            <div className="mt-3 flex flex-wrap justify-between gap-2">
              <Knob
                label="Cut"
                value={p.filter.cutoff}
                defaultValue={0.62}
                format={fmtHz}
                onChange={(cutoff) => update(clonePatch(p, { filter: { ...p.filter, cutoff } }))}
              />
              <Knob
                label="Res"
                value={p.filter.resonance}
                format={fmtPct}
                onChange={(resonance) => update(clonePatch(p, { filter: { ...p.filter, resonance } }))}
              />
              <Knob
                label="Env"
                value={p.filter.envAmount}
                format={fmtPct}
                onChange={(envAmount) => update(clonePatch(p, { filter: { ...p.filter, envAmount } }))}
              />
              <Knob
                label="Key"
                value={p.filter.keyTrack}
                format={fmtPct}
                onChange={(keyTrack) => update(clonePatch(p, { filter: { ...p.filter, keyTrack } }))}
              />
            </div>
          </Panel>

          <Panel title="Amp / Filter EG">
            <div className="text-[0.625rem] uppercase tracking-wide text-subtle">Amp</div>
            <div className="mt-1 flex flex-wrap justify-between gap-2">
              <Knob
                label="A"
                value={p.ampEnv.attack}
                min={0.001}
                max={4}
                format={fmtMs}
                onChange={(attack) => update(clonePatch(p, { ampEnv: { ...p.ampEnv, attack } }))}
              />
              <Knob
                label="D"
                value={p.ampEnv.decay}
                min={0.01}
                max={4}
                format={fmtMs}
                onChange={(decay) => update(clonePatch(p, { ampEnv: { ...p.ampEnv, decay } }))}
              />
              <Knob
                label="S"
                value={p.ampEnv.sustain}
                format={fmtPct}
                onChange={(sustain) => update(clonePatch(p, { ampEnv: { ...p.ampEnv, sustain } }))}
              />
              <Knob
                label="R"
                value={p.ampEnv.release}
                min={0.01}
                max={8}
                format={fmtMs}
                onChange={(release) => update(clonePatch(p, { ampEnv: { ...p.ampEnv, release } }))}
              />
            </div>
            <div className="mt-3 text-[0.625rem] uppercase tracking-wide text-subtle">Filter</div>
            <div className="mt-1 flex flex-wrap justify-between gap-2">
              <Knob
                label="A"
                value={p.filterEnv.attack}
                min={0.001}
                max={4}
                format={fmtMs}
                onChange={(attack) => update(clonePatch(p, { filterEnv: { ...p.filterEnv, attack } }))}
              />
              <Knob
                label="D"
                value={p.filterEnv.decay}
                min={0.01}
                max={4}
                format={fmtMs}
                onChange={(decay) => update(clonePatch(p, { filterEnv: { ...p.filterEnv, decay } }))}
              />
              <Knob
                label="S"
                value={p.filterEnv.sustain}
                format={fmtPct}
                onChange={(sustain) => update(clonePatch(p, { filterEnv: { ...p.filterEnv, sustain } }))}
              />
              <Knob
                label="R"
                value={p.filterEnv.release}
                min={0.01}
                max={8}
                format={fmtMs}
                onChange={(release) => update(clonePatch(p, { filterEnv: { ...p.filterEnv, release } }))}
              />
            </div>
          </Panel>

          <Panel title="LFO / FX">
            <ModeRow
              label="LFO dest"
              value={p.lfo.dest}
              options={
                [
                  { id: "cutoff", label: "Cutoff" },
                  { id: "pitch", label: "Pitch" },
                ] as { id: LfoDest; label: string }[]
              }
              onChange={(dest) => update(clonePatch(p, { lfo: { ...p.lfo, dest } }))}
            />
            <div className="mt-2">
              <ModeRow
                label="Shape"
                value={p.lfo.wave}
                options={
                  [
                    { id: "sine", label: "Sin" },
                    { id: "triangle", label: "Tri" },
                    { id: "sawtooth", label: "Saw" },
                    { id: "square", label: "Sqr" },
                  ] as { id: LfoWave; label: string }[]
                }
                onChange={(wave) => update(clonePatch(p, { lfo: { ...p.lfo, wave } }))}
              />
            </div>
            <div className="mt-3 flex flex-wrap justify-between gap-2">
              <Knob
                label="Rate"
                value={p.lfo.rate}
                min={0.05}
                max={18}
                format={(v) => `${v.toFixed(2)}`}
                onChange={(rate) => update(clonePatch(p, { lfo: { ...p.lfo, rate } }))}
              />
              <Knob
                label="Depth"
                value={p.lfo.depth}
                format={fmtPct}
                onChange={(depth) => update(clonePatch(p, { lfo: { ...p.lfo, depth } }))}
              />
              <Knob
                label="Delay"
                value={p.fx.delayMix}
                format={fmtPct}
                onChange={(delayMix) => update(clonePatch(p, { fx: { ...p.fx, delayMix } }))}
              />
              <Knob
                label="Time"
                value={p.fx.delayTime}
                min={0.05}
                max={0.9}
                format={(v) => `${Math.round(v * 1000)}`}
                onChange={(delayTime) => update(clonePatch(p, { fx: { ...p.fx, delayTime } }))}
              />
              <Knob
                label="Fdbk"
                value={p.fx.delayFeedback}
                format={fmtPct}
                onChange={(delayFeedback) => update(clonePatch(p, { fx: { ...p.fx, delayFeedback } }))}
              />
              <Knob
                label="Rev"
                value={p.fx.reverbMix}
                format={fmtPct}
                onChange={(reverbMix) => update(clonePatch(p, { fx: { ...p.fx, reverbMix } }))}
              />
              <Knob
                label="Chor"
                value={p.fx.chorusMix}
                format={fmtPct}
                onChange={(chorusMix) => update(clonePatch(p, { fx: { ...p.fx, chorusMix } }))}
              />
              <Knob
                label="Level"
                value={p.master}
                format={fmtPct}
                onChange={(master) => update(clonePatch(p, { master }))}
              />
            </div>
          </Panel>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
          <Panel title="Arpeggiator">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => update(clonePatch(p, { arp: { ...p.arp, on: !p.arp.on } }))}
                className={cn(
                  "h-11 rounded-lg px-4 text-sm font-semibold",
                  p.arp.on ? "bg-accent text-accent-fg" : "bg-elevated text-muted",
                )}
              >
                {p.arp.on ? "Arp on" : "Arp off"}
              </button>
              <ModeRow
                label="Mode"
                value={p.arp.mode}
                options={
                  [
                    { id: "up", label: "Up" },
                    { id: "down", label: "Down" },
                    { id: "updown", label: "Up/Dn" },
                    { id: "random", label: "Rand" },
                    { id: "asplayed", label: "Held" },
                  ] as { id: ArpMode; label: string }[]
                }
                onChange={(mode) => update(clonePatch(p, { arp: { ...p.arp, mode } }))}
              />
            </div>
            <div className="mt-3 flex flex-wrap justify-between gap-2">
              <Knob
                label="Tempo"
                value={p.arp.tempo}
                min={60}
                max={180}
                step={1}
                format={(v) => `${Math.round(v)}`}
                onChange={(tempo) => update(clonePatch(p, { arp: { ...p.arp, tempo } }))}
              />
              <Knob
                label="Gate"
                value={p.arp.gate}
                format={fmtPct}
                onChange={(gate) => update(clonePatch(p, { arp: { ...p.arp, gate } }))}
              />
              <Knob
                label="Swing"
                value={p.arp.swing}
                format={fmtPct}
                onChange={(swing) => update(clonePatch(p, { arp: { ...p.arp, swing } }))}
              />
              <Knob
                label="Oct"
                value={p.arp.octaves}
                min={1}
                max={3}
                step={1}
                format={(v) => `${Math.round(v)}`}
                onChange={(octaves) =>
                  update(clonePatch(p, { arp: { ...p.arp, octaves: Math.round(octaves) as 1 | 2 | 3 } }))
                }
              />
            </div>
            <div className="mt-3">
              <ModeRow
                label="Rate"
                value={p.arp.rate}
                options={
                  [
                    { id: "1/4", label: "1/4" },
                    { id: "1/8", label: "1/8" },
                    { id: "1/8t", label: "1/8t" },
                    { id: "1/16", label: "1/16" },
                    { id: "1/16t", label: "1/16t" },
                  ] as { id: ArpRate; label: string }[]
                }
                onChange={(rate) => update(clonePatch(p, { arp: { ...p.arp, rate } }))}
              />
            </div>
          </Panel>
          <Panel title="Scope">
            {engine ? <Scope /> : <div className="h-24 rounded-lg bg-ink-soft sm:h-28" />}
            <p className="mt-2 text-xs text-subtle">Live output after the effects rack.</p>
          </Panel>
        </div>

        <Panel title={`Library · ${factory.length} factory`}>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setLibCat("All")}
              className={cn(
                "h-8 rounded-md px-2.5 text-[0.6875rem] font-medium",
                libCat === "All" ? "bg-accent text-accent-fg" : "bg-elevated text-muted hover:text-fg",
              )}
            >
              All
            </button>
            {factoryGroups.map((g) => (
              <button
                key={g.category}
                type="button"
                onClick={() => setLibCat(g.category)}
                className={cn(
                  "h-8 rounded-md px-2.5 text-[0.6875rem] font-medium",
                  libCat === g.category ? "bg-accent text-accent-fg" : "bg-elevated text-muted hover:text-fg",
                )}
              >
                {g.category}
                <span className="ml-1 tabular-nums opacity-70">{g.patches.length}</span>
              </button>
            ))}
          </div>
          <input
            value={libQ}
            onChange={(e) => setLibQ(e.target.value)}
            placeholder="Search patches"
            className="mt-3 h-11 w-full rounded-lg bg-elevated px-3 text-sm text-fg placeholder:text-subtle"
          />
          <div className="mt-3 grid max-h-56 grid-cols-2 gap-1 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
            {filteredFactory.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => loadPatch(x)}
                className={cn(
                  "truncate rounded-md px-2 py-2 text-left text-[0.75rem]",
                  x.id === p.id ? "bg-accent text-accent-fg" : "bg-elevated text-fg hover:text-accent",
                )}
                title={`${x.category} — ${x.name}`}
              >
                {x.name}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Name this patch"
              className="h-11 flex-1 rounded-lg bg-elevated px-3 text-sm text-fg placeholder:text-subtle"
            />
            <button
              type="button"
              onClick={() => {
                saveUserPatch(nameDraft);
                setNameDraft("");
              }}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg"
            >
              <Save className="size-4" />
              Save
            </button>
          </div>
          {userPatches.length > 0 && (
            <ul className="mt-3 divide-y divide-border">
              {userPatches.map((u) => (
                <li key={u.id} className="flex items-center gap-2 py-2">
                  <button type="button" className="flex-1 text-left text-sm hover:text-accent" onClick={() => loadPatch(u)}>
                    {u.name}
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${u.name}`}
                    className="grid size-10 place-items-center rounded-md text-muted hover:text-fg"
                    onClick={() => deleteUserPatch(u.id)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 p-3 backdrop-blur-sm sm:p-4">
        <div className="mx-auto max-w-6xl">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              <KeyboardIcon className="size-3.5" />
              Keyboard
            </h2>
            <div className="flex items-center gap-2">
              <button type="button" className="h-10 rounded-md bg-elevated px-3 text-sm" onClick={() => shiftOctave(-1)}>
                Oct −
              </button>
              <span className="font-mono text-xs tabular-nums text-muted">C{3 + octave}</span>
              <button type="button" className="h-10 rounded-md bg-elevated px-3 text-sm" onClick={() => shiftOctave(1)}>
                Oct +
              </button>
              <button
                type="button"
                className="h-10 rounded-md bg-accent px-3 text-sm font-semibold text-accent-fg"
                onClick={() => {
                  const phrase = [48, 52, 55, 60, 55, 52, 48];
                  noteOn(phrase[0]!, 0.85);
                  window.setTimeout(() => noteOff(phrase[0]!), 220);
                  phrase.slice(1).forEach((n, i) => {
                    window.setTimeout(() => {
                      noteOn(n, 0.8);
                      window.setTimeout(() => noteOff(n), 220);
                    }, (i + 1) * 260);
                  });
                }}
              >
                Phrase
              </button>
            </div>
          </div>
          <Keyboard />
          <p className="mt-2 text-xs text-subtle">
            {armed
              ? "A–L whites, W/E/T/Y/U/O/P blacks. Z / X octave. Esc panic."
              : "Press a piano key or A–L — sound starts on that press."}
          </p>
        </div>
      </div>
    </div>
  );
}

function MidiBadge({ status, name }: { status: string; name: string | null }) {
  const label =
    status === "ok"
      ? name ?? "MIDI"
      : status === "unsupported"
        ? "No Web MIDI"
        : status === "denied"
          ? "MIDI blocked"
          : status === "none"
            ? "No keyboard"
            : "MIDI idle";
  return (
    <div
      className={cn(
        "flex h-11 max-w-44 items-center gap-2 truncate rounded-lg px-3 text-xs",
        status === "ok" ? "bg-elevated text-accent" : "bg-elevated text-muted",
      )}
      title={label}
    >
      <Usb className="size-3.5 shrink-0" />
      <span className="truncate">{label}</span>
      <span className={cn("size-1.5 shrink-0 rounded-full", status === "ok" ? "bg-accent" : "bg-subtle")} />
    </div>
  );
}
