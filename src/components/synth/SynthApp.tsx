import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Cable,
  CircleHelp,
  Keyboard as KeyboardIcon,
  Pencil,
  Save,
  Star,
  Trash2,
  Volume2,
  VolumeX,
  Usb,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { clonePatch, groupByCategory } from "@/lib/synth/patches";
import { bindAudioUnlock, bindComputerKeyboard, useSynth } from "@/lib/synth/store";
import { tapTempo } from "@/lib/synth/tap-tempo";
import { midiBadgeLabel } from "@/lib/synth/midi";
import type {
  ArpMode,
  ArpRate,
  FilterSlope,
  FilterType,
  LfoDest,
  LfoParams,
  LfoWave,
  ModDest,
  ModRoute,
  ModSource,
  Patch,
  PolyMode,
  Waveform,
} from "@/lib/synth/types";
import { Keyboard } from "./Keyboard";
import { DawPanel } from "./DawPanel";
import { HelpPanel } from "./HelpPanel";
import { LayerStrip } from "./LayerStrip";
import { PatternBar } from "./PatternBar";
import { GrooveBar } from "./GrooveBar";
import { AmtFader, Knob, LfoSlider, Seg } from "./Knob";
import { Scope } from "./Scope";

function fmtHz(v: number) {
  const hz = 20 * Math.pow(1000, v);
  return hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : `${Math.round(hz)}`;
}
function fmtMs(v: number) {
  return v < 1 ? `${Math.round(v * 1000)}` : `${v.toFixed(1)}s`;
}
function fmtPct(v: number) {
  return `${Math.round(v * 100)}`;
}

const WAVES: { id: Waveform; label: string; title: string }[] = [
  { id: "sine", label: "Sin", title: "Sine" },
  { id: "triangle", label: "Tri", title: "Triangle" },
  { id: "sawtooth", label: "Saw", title: "Sawtooth" },
  { id: "square", label: "Sqr", title: "Square" },
  { id: "pulse", label: "Pul", title: "Pulse" },
  { id: "supersaw", label: "Stk", title: "Stack" },
  { id: "wt", label: "Tbl", title: "Wavetable" },
];

const LFO_DEST: { id: LfoDest; label: string }[] = [
  { id: "cutoff", label: "Cut" },
  { id: "pitch", label: "Pch" },
  { id: "pan", label: "Pan" },
  { id: "amp", label: "Amp" },
  { id: "res", label: "Res" },
  { id: "fm", label: "FM" },
];

const LFO_WAVE: { id: LfoWave; label: string }[] = [
  { id: "sine", label: "Sin" },
  { id: "triangle", label: "Tri" },
  { id: "sawtooth", label: "Saw" },
  { id: "square", label: "Sqr" },
];

const MOD_SRC: { id: ModSource; label: string }[] = [
  { id: "lfo1", label: "LFO1" },
  { id: "lfo2", label: "LFO2" },
  { id: "fenv", label: "FEG" },
  { id: "vel", label: "Vel" },
  { id: "mod", label: "Mod" },
  { id: "at", label: "AT" },
];

function Cell({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("lyra-cell", className)}>
      <h2 className="lyra-cell-title">{title}</h2>
      {children}
    </section>
  );
}

export function SynthApp() {
  const ctxState = useSynth((s) => s.ctxState);
  const patch = useSynth((s) => s.patch);
  const setPatch = useSynth((s) => s.setPatch);
  const loadPatch = useSynth((s) => s.loadPatch);
  const factory = useSynth((s) => s.factory);
  const userPatches = useSynth((s) => s.userPatches);
  const saveUserPatch = useSynth((s) => s.saveUserPatch);
  const renameUserPatch = useSynth((s) => s.renameUserPatch);
  const deleteUserPatch = useSynth((s) => s.deleteUserPatch);
  const favorites = useSynth((s) => s.favorites);
  const toggleFavorite = useSynth((s) => s.toggleFavorite);
  const midiStatus = useSynth((s) => s.midiStatus);
  const midiName = useSynth((s) => s.midiName);
  const voices = useSynth((s) => s.voices);
  const octave = useSynth((s) => s.octave);
  const transpose = useSynth((s) => s.transpose);
  const shiftOctave = useSynth((s) => s.shiftOctave);
  const shiftTranspose = useSynth((s) => s.shiftTranspose);
  const panic = useSynth((s) => s.panic);
  const mute = useSynth((s) => s.masterMute);
  const toggleMute = useSynth((s) => s.toggleMute);
  const showKeys = useSynth((s) => s.showKeys);
  const toggleKeys = useSynth((s) => s.toggleKeys);
  const dawOpen = useSynth((s) => s.dawOpen);
  const setDawOpen = useSynth((s) => s.setDawOpen);
  const helpOpen = useSynth((s) => s.helpOpen);
  const setHelpOpen = useSynth((s) => s.setHelpOpen);
  const clockFollow = useSynth((s) => s.clockFollow);
  const clockRunning = useSynth((s) => s.clockRunning);
  const engine = useSynth((s) => s.engine);
  const arpStep = useSynth((s) => s.arpStep);
  const [nameDraft, setNameDraft] = useState("");
  const [libCat, setLibCat] = useState("All");
  const [libQ, setLibQ] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

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
  const favoritePatches = useMemo(
    () => allPatches.filter((x) => favorites.includes(x.id)),
    [allPatches, favorites],
  );
  const filteredFactory = useMemo(() => {
    const q = libQ.trim().toLowerCase();
    const pool = libCat === "Favorite" ? favoritePatches : factory;
    return pool.filter((x) => {
      if (libCat !== "All" && libCat !== "Favorite" && x.category !== libCat) return false;
      if (!q) return true;
      return x.name.toLowerCase().includes(q) || x.category.toLowerCase().includes(q);
    });
  }, [factory, favoritePatches, libCat, libQ]);

  const update = (next: Patch) => setPatch(next);
  const p = patch;
  const live = ctxState === "running";

  const setMatrix = (i: number, row: ModRoute) => {
    const matrix = [...p.matrix];
    matrix[i] = row;
    update(clonePatch(p, { matrix }));
  };

  return (
    <div
      className={cn("flex min-h-dvh flex-col overflow-x-hidden bg-bg text-fg", showKeys ? "pb-24" : "pb-4")}
      data-audio={ctxState}
    >
      <header className="sticky top-0 z-20 border-b border-border bg-bg/95 px-3 py-1.5 backdrop-blur-sm">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="lyra-brand min-w-0">
              <MidiBadge status={midiStatus} name={midiName} />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center" title="Transpose all incoming notes (MIDI, keys, piano)">
                <button type="button" className="h-10 rounded-l-md bg-elevated px-2.5 text-base font-semibold" onClick={() => shiftTranspose(-1)} aria-label="Transpose down">
                  −
                </button>
                <button
                  type="button"
                  className="h-10 min-w-12 bg-elevated px-1.5 font-mono text-sm font-semibold tabular-nums text-muted"
                  title="Reset transpose"
                  onClick={() => useSynth.setState({ transpose: 0 })}
                >
                  {transpose === 0 ? "0" : transpose > 0 ? `+${transpose}` : `${transpose}`}
                  <span className="ml-0.5 text-[0.6rem] tracking-wide">TR</span>
                </button>
                <button type="button" className="h-10 rounded-r-md bg-elevated px-2.5 text-base font-semibold" onClick={() => shiftTranspose(1)} aria-label="Transpose up">
                  +
                </button>
              </div>
              <div
                className={cn(
                  "hidden h-10 w-14 shrink-0 items-center justify-center rounded-md text-sm font-semibold md:flex",
                  live ? "text-accent" : "text-muted",
                )}
              >
                {live ? "Live" : "Idle"}
              </div>
            </div>
          </div>

          <div className="flex w-72 items-center justify-center sm:w-96">
            <Scope compact />
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              aria-label="Tap tempo"
              title="Tap two or more times to set BPM"
              onClick={() => tapTempo((tempo) => update(clonePatch(p, { arp: { ...p.arp, tempo } })))}
              className="h-10 shrink-0 rounded-md bg-elevated px-3 text-base font-semibold text-muted hover:text-fg"
            >
              Tap
            </button>
            <BpmReadout tempo={p.arp.tempo} />
            <div
              className="flex h-10 w-12 shrink-0 items-center justify-center gap-1 font-mono text-sm tabular-nums text-muted"
            >
              <Activity className="size-3.5 shrink-0" />
              <span className="w-5 text-right">{voices}</span>
            </div>
            <div className="flex items-center" title="On-screen / computer keyboard octave">
              <button type="button" className="h-10 rounded-l-md bg-elevated px-2.5 text-base font-semibold" onClick={() => shiftOctave(-1)}>
                −
              </button>
              <span className="h-10 bg-elevated px-2 font-mono text-base font-semibold leading-10 tabular-nums text-muted">C{3 + octave}</span>
              <button type="button" className="h-10 rounded-r-md bg-elevated px-2.5 text-base font-semibold" onClick={() => shiftOctave(1)}>
                +
              </button>
            </div>
            <button
              type="button"
              onClick={toggleKeys}
              className={cn("grid size-10 place-items-center rounded-md", showKeys ? "bg-accent text-accent-fg" : "bg-elevated text-fg")}
              aria-label={showKeys ? "Hide on-screen keyboard" : "Show on-screen keyboard"}
              title={showKeys ? "Hide keyboard" : "Show keyboard"}
            >
              <KeyboardIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={toggleMute}
              className={cn(
                "grid size-10 place-items-center rounded-md",
                mute ? "bg-accent text-accent-fg" : "bg-elevated text-fg",
              )}
              aria-label={mute ? "Unmute" : "Mute"}
            >
              {mute ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
            <button
              type="button"
              onClick={() => {
                useSynth.getState().arm();
                setDawOpen(true);
              }}
              className={cn(
                "h-10 rounded-md px-3 text-base font-semibold",
                dawOpen || (clockFollow && clockRunning) ? "bg-accent text-accent-fg" : "bg-elevated text-muted hover:text-fg",
              )}
              title="DAW / IAC setup"
            >
              <span className="inline-flex items-center gap-1.5">
                <Cable className="size-4" />
                DAW
              </span>
            </button>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className={cn(
                "grid size-10 place-items-center rounded-md",
                helpOpen ? "bg-accent text-accent-fg" : "bg-elevated text-muted hover:text-fg",
              )}
              aria-label="Open help"
              title="Help (?)"
            >
              <CircleHelp className="size-4" />
            </button>
            <button
              type="button"
              onClick={panic}
              className="h-10 rounded-md bg-elevated px-3 text-base font-semibold text-muted hover:text-fg"
            >
              Panic
            </button>
            </div>
          </div>
        </div>
      </header>

      <LayerStrip patches={allPatches} />

      <main className="flex min-h-0 w-full flex-1 flex-col px-1 py-1 sm:px-2">
        <div className={cn("lyra-face", showKeys && "keys-on")}>
          <Cell title="Oscillator 1">
            <Seg value={p.osc1.wave} options={WAVES} onChange={(wave) => update(clonePatch(p, { osc1: { ...p.osc1, wave } }))} />
            <div className="lyra-knobs mt-2">
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
                format={(v) => `${v}¢`}
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
                label={p.osc1.wave === "wt" ? "Morph" : "PWM"}
                value={p.osc1.pwm}
                defaultValue={0.5}
                format={fmtPct}
                onChange={(pwm) => update(clonePatch(p, { osc1: { ...p.osc1, pwm } }))}
              />
            </div>
          </Cell>

          <Cell title="Oscillator 2">
            <Seg value={p.osc2.wave} options={WAVES} onChange={(wave) => update(clonePatch(p, { osc2: { ...p.osc2, wave } }))} />
            <div className="lyra-knobs mt-2">
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
                format={(v) => `${v}¢`}
                onChange={(fine) => update(clonePatch(p, { osc2: { ...p.osc2, fine } }))}
              />
              <Knob
                label="Level"
                value={p.osc2.level}
                defaultValue={0.7}
                arm
                armOn={0.7}
                format={fmtPct}
                onChange={(level) => update(clonePatch(p, { osc2: { ...p.osc2, level } }))}
              />
              <Knob label="FM" value={p.fmIndex} defaultValue={0} arm armOn={0.28} format={fmtPct} onChange={(fmIndex) => update(clonePatch(p, { fmIndex }))} />
            </div>
          </Cell>

          <Cell title="Mixer">
            <div className="flex gap-1">
              <div className="min-w-0 flex-[3]">
                <Seg
                  compact
                  value={p.polyMode}
                  options={
                    [
                      { id: "poly", label: "Poly" },
                      { id: "mono", label: "Mono" },
                      { id: "legato", label: "Leg" },
                    ] as { id: PolyMode; label: string }[]
                  }
                  onChange={(polyMode) => update(clonePatch(p, { polyMode }))}
                />
              </div>
              <div className="min-w-0 flex-[2]">
                <Seg
                  compact
                  value={String(p.unison.voices) as "1" | "2" | "3"}
                  options={[
                    { id: "1", label: "Off" },
                    { id: "2", label: "2" },
                    { id: "3", label: "3" },
                  ]}
                  onChange={(v) =>
                    update(clonePatch(p, { unison: { ...p.unison, voices: Number(v) as 1 | 2 | 3 } }))
                  }
                />
              </div>
            </div>
            <div className="lyra-knobs mt-3">
              <Knob label="Sub" value={p.subLevel} arm armOn={0.4} format={fmtPct} onChange={(subLevel) => update(clonePatch(p, { subLevel }))} />
              <Knob label="Noise" value={p.noiseLevel} arm armOn={0.22} format={fmtPct} onChange={(noiseLevel) => update(clonePatch(p, { noiseLevel }))} />
              <Knob label="Drive" value={p.drive} arm armOn={0.28} format={fmtPct} onChange={(drive) => update(clonePatch(p, { drive }))} />
              <Knob label="Ring" value={p.ring} arm armOn={0.4} format={fmtPct} onChange={(ring) => update(clonePatch(p, { ring }))} />
              <Knob label="Sync" value={p.sync} arm armOn={0.35} format={fmtPct} onChange={(sync) => update(clonePatch(p, { sync }))} />
              <Knob label="Drift" value={p.drift} arm armOn={0.2} format={fmtPct} onChange={(drift) => update(clonePatch(p, { drift }))} />
              <Knob label="Glide" value={p.glide} arm armOn={0.18} format={fmtPct} onChange={(glide) => update(clonePatch(p, { glide }))} />
              <Knob label="Out" value={p.master} format={fmtPct} onChange={(master) => update(clonePatch(p, { master }))} />
            </div>
          </Cell>

          <Cell title="Filter">
            <div className="flex flex-col gap-1">
              <Seg
                value={p.filter.type}
                options={
                  [
                    { id: "lowpass", label: "LP" },
                    { id: "highpass", label: "HP" },
                    { id: "bandpass", label: "BP" },
                    { id: "notch", label: "N" },
                  ] as { id: FilterType; label: string }[]
                }
                onChange={(type) => update(clonePatch(p, { filter: { ...p.filter, type } }))}
              />
              <Seg
                value={String(p.filter.slope) as "12" | "24"}
                options={[
                  { id: "12", label: "12 dB" },
                  { id: "24", label: "24 dB" },
                ]}
                onChange={(s) => update(clonePatch(p, { filter: { ...p.filter, slope: Number(s) as FilterSlope } }))}
              />
            </div>
            <div className="lyra-knobs lyra-knobs-5 mt-2">
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
                arm
                armOn={0.35}
                format={fmtPct}
                onChange={(envAmount) => update(clonePatch(p, { filter: { ...p.filter, envAmount } }))}
              />
              <Knob
                label="Key"
                value={p.filter.keyTrack}
                arm
                armOn={0.3}
                format={fmtPct}
                onChange={(keyTrack) => update(clonePatch(p, { filter: { ...p.filter, keyTrack } }))}
              />
              <Knob label="Vel" value={p.velFilt} arm armOn={0.35} format={fmtPct} onChange={(velFilt) => update(clonePatch(p, { velFilt }))} />
            </div>
          </Cell>

          <Cell title="Amp EG">
            <EnvKnobs env={p.ampEnv} onChange={(ampEnv) => update(clonePatch(p, { ampEnv }))} />
          </Cell>
          <Cell title="Filter EG">
            <EnvKnobs env={p.filterEnv} onChange={(filterEnv) => update(clonePatch(p, { filterEnv }))} />
          </Cell>

          <LfoCell title="LFO 1" lfo={p.lfo} onChange={(lfo) => update(clonePatch(p, { lfo }))} />
          <LfoCell title="LFO 2" lfo={p.lfo2} onChange={(lfo2) => update(clonePatch(p, { lfo2 }))} />

          <Cell title="FX">
            <div className="lyra-knobs lyra-knobs-3">
              <Knob
                label="Delay"
                value={p.fx.delayMix}
                arm
                armOn={0.22}
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
                arm
                armOn={0.22}
                format={fmtPct}
                onChange={(reverbMix) => update(clonePatch(p, { fx: { ...p.fx, reverbMix } }))}
              />
              <Knob
                label="Chor"
                value={p.fx.chorusMix}
                arm
                armOn={0.2}
                format={fmtPct}
                onChange={(chorusMix) => update(clonePatch(p, { fx: { ...p.fx, chorusMix } }))}
              />
              <Knob
                label="Phsr"
                value={p.fx.phaserMix}
                arm
                armOn={0.16}
                format={fmtPct}
                onChange={(phaserMix) => update(clonePatch(p, { fx: { ...p.fx, phaserMix } }))}
              />
            </div>
          </Cell>

          <Cell title="Arpeggiator">
            <div className="flex min-h-0 flex-1 flex-col justify-center gap-2.5">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => update(clonePatch(p, { arp: { ...p.arp, on: !p.arp.on } }))}
                className={cn(
                  "h-10 shrink-0 rounded-md px-3 text-sm font-semibold",
                  p.arp.on ? "bg-accent text-accent-fg" : "bg-elevated text-muted",
                )}
              >
                {p.arp.on ? "On" : "Off"}
              </button>
              <button
                type="button"
                title="Latch the current chord after you lift your hands"
                onClick={() => update(clonePatch(p, { arp: { ...p.arp, hold: !p.arp.hold } }))}
                className={cn(
                  "h-10 shrink-0 rounded-md px-3 text-sm font-semibold",
                  p.arp.hold ? "bg-accent text-accent-fg" : "bg-elevated text-muted",
                )}
              >
                Hold
              </button>
              <div className="min-w-0 flex-1">
                <Seg
                  value={p.arp.mode}
                  options={
                    [
                      { id: "up", label: "Up" },
                      { id: "down", label: "Dn" },
                      { id: "updown", label: "U/D" },
                      { id: "random", label: "Rnd" },
                      { id: "asplayed", label: "Ord" },
                    ] as { id: ArpMode; label: string }[]
                  }
                  onChange={(mode) => update(clonePatch(p, { arp: { ...p.arp, mode } }))}
                />
              </div>
            </div>
            <div className="lyra-knobs flex-none">
              <Knob
                label="Tempo"
                value={p.arp.tempo}
                min={60}
                max={180}
                step={1}
                format={(v) => `${Math.round(v)}`}
                onChange={(tempo) => update(clonePatch(p, { arp: { ...p.arp, tempo } }))}
              />
              <Knob label="Gate" value={p.arp.gate} format={fmtPct} onChange={(gate) => update(clonePatch(p, { arp: { ...p.arp, gate } }))} />
              <Knob
                label="Swing"
                value={p.arp.swing}
                arm
                armOn={0.22}
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
            <div>
              <Seg
                compact
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
            </div>
          </Cell>

          <Cell title="Matrix" className="lyra-span-2">
            <div className="flex min-h-0 flex-1 flex-col justify-evenly gap-1.5">
              {p.matrix.map((row, i) => (
                <div key={i} className="lyra-matrix-row">
                  <select
                    aria-label={`Matrix ${i + 1} source`}
                    className="h-10 min-w-0 rounded-md bg-elevated px-1.5 text-sm text-fg"
                    value={row.src}
                    onChange={(e) => setMatrix(i, { ...row, src: e.target.value as ModSource })}
                  >
                    {MOD_SRC.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`Matrix ${i + 1} destination`}
                    className="h-10 min-w-0 rounded-md bg-elevated px-1.5 text-sm text-fg"
                    value={row.dest}
                    onChange={(e) => setMatrix(i, { ...row, dest: e.target.value as ModDest })}
                  >
                    {LFO_DEST.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <AmtFader label="Amt" value={row.amount} onChange={(amount) => setMatrix(i, { ...row, amount })} />
                </div>
              ))}
            </div>
          </Cell>
        </div>

        <PatternBar patch={p} playhead={arpStep} onChange={update} />
        <GrooveBar />

        <section className="lyra-lib mt-3 rounded-xl bg-surface p-4">
          <h2 className="lyra-cell-title">Library · {factory.length} factory</h2>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setLibCat("All")}
              className={cn(
                "h-12 rounded-md px-3.5 text-lg font-medium",
                libCat === "All" ? "bg-accent text-accent-fg" : "bg-elevated text-muted hover:text-fg",
              )}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setLibCat("Favorite")}
              className={cn(
                "h-12 rounded-md px-3.5 text-lg font-medium",
                libCat === "Favorite" ? "bg-accent text-accent-fg" : "bg-elevated text-muted hover:text-fg",
              )}
            >
              Favorite
              <span className="ml-1 tabular-nums opacity-70">{favoritePatches.length}</span>
            </button>
            {factoryGroups.map((g) => (
              <button
                key={g.category}
                type="button"
                onClick={() => setLibCat(g.category)}
                className={cn(
                  "h-12 rounded-md px-3.5 text-lg font-medium",
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
          <div className="mt-3 grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filteredFactory.map((x) => {
              const fav = favorites.includes(x.id);
              return (
                <div
                  key={x.id}
                  className={cn(
                    "flex min-w-0 items-center rounded-md",
                    x.id === p.id ? "bg-accent text-accent-fg" : "bg-elevated text-fg",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => loadPatch(x)}
                    className={cn(
                      "min-w-0 flex-1 truncate px-3 py-2.5 text-left text-lg",
                      x.id !== p.id && "hover:text-accent",
                    )}
                    title={`${x.category} — ${x.name}`}
                  >
                    {x.name}
                  </button>
                  <button
                    type="button"
                    aria-label={fav ? `Unfavorite ${x.name}` : `Favorite ${x.name}`}
                    className={cn(
                      "grid size-10 shrink-0 place-items-center",
                      fav ? "text-accent" : "text-muted hover:text-fg",
                      x.id === p.id && "text-accent-fg",
                    )}
                    onClick={() => toggleFavorite(x.id)}
                  >
                    <Star className={cn("size-4", fav && "fill-current")} />
                  </button>
                </div>
              );
            })}
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
                  {renameId === u.id ? (
                    <input
                      autoFocus
                      value={renameDraft}
                      aria-label={`Rename ${u.name}`}
                      className="h-10 min-w-0 flex-1 rounded-md bg-elevated px-3 text-lg text-fg"
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onBlur={(e) => {
                        if (e.currentTarget.dataset.cancel === "1") return;
                        renameUserPatch(u.id, renameDraft);
                        setRenameId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          renameUserPatch(u.id, renameDraft);
                          setRenameId(null);
                          e.currentTarget.blur();
                        }
                        if (e.key === "Escape") {
                          e.currentTarget.dataset.cancel = "1";
                          setRenameId(null);
                          e.currentTarget.blur();
                        }
                      }}
                    />
                  ) : (
                    <button type="button" className="min-w-0 flex-1 truncate text-left text-lg hover:text-accent" onClick={() => loadPatch(u)}>
                      {u.name}
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={`Rename ${u.name}`}
                    className="grid size-10 shrink-0 place-items-center rounded-md text-muted hover:text-fg"
                    onClick={() => {
                      setRenameId(u.id);
                      setRenameDraft(u.name);
                    }}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${u.name}`}
                    className="grid size-10 shrink-0 place-items-center rounded-md text-muted hover:text-fg"
                    onClick={() => deleteUserPatch(u.id)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {showKeys && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 px-3 py-2">
          <div className="flex items-center gap-3">
            <Keyboard />
            <button
              type="button"
              className="h-8 shrink-0 rounded-md bg-elevated px-2 text-2xs text-muted hover:text-fg"
              onClick={toggleKeys}
            >
              Hide
            </button>
          </div>
        </div>
      )}
      <DawPanel />
      <HelpPanel />
    </div>
  );
}

function EnvKnobs({
  env,
  onChange,
}: {
  env: Patch["ampEnv"];
  onChange: (e: Patch["ampEnv"]) => void;
}) {
  return (
    <div className="lyra-knobs">
      <Knob label="A" value={env.attack} min={0.001} max={4} format={fmtMs} onChange={(attack) => onChange({ ...env, attack })} />
      <Knob label="D" value={env.decay} min={0.01} max={4} format={fmtMs} onChange={(decay) => onChange({ ...env, decay })} />
      <Knob label="S" value={env.sustain} format={fmtPct} onChange={(sustain) => onChange({ ...env, sustain })} />
      <Knob label="R" value={env.release} min={0.01} max={8} format={fmtMs} onChange={(release) => onChange({ ...env, release })} />
    </div>
  );
}

function LfoCell({ title, lfo, onChange }: { title: string; lfo: LfoParams; onChange: (l: LfoParams) => void }) {
  return (
    <Cell title={title} className="lyra-lfo">
      <div className="flex min-h-0 flex-1 flex-col justify-evenly gap-2">
        <div className="flex shrink-0 flex-col gap-1">
          <Seg compact value={lfo.dest} options={LFO_DEST} onChange={(dest) => onChange({ ...lfo, dest })} />
          <Seg compact value={lfo.wave} options={LFO_WAVE} onChange={(wave) => onChange({ ...lfo, wave })} />
        </div>
        <div className="lyra-lfo-sliders">
          <LfoSlider
            label="Rate"
            value={lfo.rate}
            min={0.05}
            max={18}
            format={(v) => v.toFixed(1)}
            onChange={(rate) => onChange({ ...lfo, rate })}
          />
          <LfoSlider label="Depth" value={lfo.depth} arm format={fmtPct} onChange={(depth) => onChange({ ...lfo, depth })} />
        </div>
      </div>
    </Cell>
  );
}

function BpmReadout({ tempo }: { tempo: number }) {
  const clockBpm = useSynth((s) => s.clockBpm);
  const clockFollow = useSynth((s) => s.clockFollow);
  const clockRunning = useSynth((s) => s.clockRunning);
  const host = clockFollow && clockRunning && clockBpm ? Math.round(clockBpm) : null;
  const bpm = host ?? Math.round(tempo);
  return (
    <div
      className="flex h-10 min-w-14 shrink-0 flex-col items-center justify-center leading-none"
      title={host ? "DAW clock" : "Arp tempo"}
    >
      <span className="font-mono text-base font-semibold tabular-nums text-fg">{bpm}</span>
      <span className="text-[0.6rem] font-semibold tracking-wider text-subtle">{host ? "CLK" : "BPM"}</span>
    </div>
  );
}

function MidiBadge({ status, name }: { status: string; name: string | null }) {
  const raw = name?.trim() || "MIDI";
  const parts = raw.split(/\s*[·|,;/]\s*/).map((s) => s.trim()).filter(Boolean);
  const label =
    status === "ok"
      ? midiBadgeLabel(parts.length ? parts : [raw])
      : status === "unsupported"
        ? "No MIDI"
        : status === "denied"
          ? "Blocked"
          : status === "none"
            ? "No kb"
            : "MIDI";
  return (
    <div
      className={cn(
        "lyra-midi-name flex min-w-0 max-w-[min(42vw,26rem)] items-center gap-1.5 font-semibold",
        status === "ok" ? "text-accent" : "text-muted",
      )}
      title={label}
    >
      <Usb className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
      <span className={cn("size-1.5 shrink-0 rounded-full", status === "ok" ? "bg-accent" : "bg-subtle")} />
    </div>
  );
}
