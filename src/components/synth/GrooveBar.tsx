import { useEffect, useMemo, useState } from "react";
import { Circle, Pencil, Play, Redo2, Save, Square, Trash2, Undo2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { BEATS, GROOVES, PHRASES } from "@/lib/synth/groove-factory";
import {
  DRUM_LABEL,
  DRUM_PARTS,
  MAX_BARS,
  NOTE_TRACKS,
  STEPS_PER_BAR,
  barOf,
  beatOf,
  grooveOf,
  noteName,
  tickOf,
  toggleArm,
  toggleDrumArm,
  toggleDrumMute,
  toggleMute,
  setTrackSound,
  withBars,
  type ClipNote,
  type DrumPart,
  type Groove,
} from "@/lib/synth/groove";
import { useSynth } from "@/lib/synth/store";

function Chip({
  on,
  children,
  onClick,
  title,
  disabled,
}: {
  on?: boolean;
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn("lyra-seq-toggle", on && "is-on")}
    >
      {children}
    </button>
  );
}

function TrackHead({
  label,
  mute,
  arm,
  onMute,
  onArm,
  onClear,
  onPad,
  padTitle,
  sound,
  sounds,
  onSound,
}: {
  label: string;
  mute: boolean;
  arm: boolean;
  onMute: () => void;
  onArm: () => void;
  onClear: () => void;
  onPad?: () => void;
  padTitle?: string;
  sound?: string;
  sounds?: { id: string; name: string; group: string }[];
  onSound?: (id: string) => void;
}) {
  return (
    <div className={cn("lyra-trk", onSound && "is-seq", mute && "is-muted")}>
      <button type="button" className={cn("lyra-trk-btn is-m", mute && "is-on")} onClick={onMute} title="Mute" aria-pressed={mute}>
        M
      </button>
      {onPad ? (
        <button type="button" className="lyra-trk-name is-pad" onClick={onPad} title={padTitle}>
          {label}
        </button>
      ) : (
        <span className="lyra-trk-name">{label}</span>
      )}
      <button type="button" className="lyra-trk-btn is-c" onClick={onClear} title="Clear this track">
        C
      </button>
      <button type="button" className={cn("lyra-trk-btn is-r", arm && "is-on")} onClick={onArm} title="Record this track" aria-pressed={arm}>
        R
      </button>
      {onSound ? (
        <select
          className="lyra-trk-sound"
          value={sound ?? "a"}
          aria-label={`Track ${label} sound`}
          onChange={(e) => onSound(e.target.value)}
        >
          <option value="a">Layer A</option>
          <option value="b">Layer B</option>
          {(sounds ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

function Grid({
  count,
  children,
}: {
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="lyra-steps" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
      {children}
    </div>
  );
}

function ClipLane({
  notes,
  barStart,
  liveStep,
  armed,
}: {
  notes: ClipNote[];
  barStart: number;
  liveStep: number;
  armed: boolean;
}) {
  const vis = STEPS_PER_BAR;
  const viewNotes = notes.filter((n) => n.start < barStart + vis && n.start + n.dur > barStart);
  const pitches = viewNotes.map((n) => n.note);
  const lo = Math.min(36, ...pitches, 48);
  const hi = Math.max(84, ...pitches, 72);
  const span = Math.max(12, hi - lo);
  const liveIn = liveStep >= barStart && liveStep < barStart + vis;
  return (
    <div className={cn("lyra-clip", armed && "is-armed")}>
      <div className="lyra-clip-cols">
        {Array.from({ length: vis }, (_, i) => (
          <div
            key={i}
            className={cn("lyra-clip-col", i % 4 === 0 && "is-beat", liveStep === barStart + i && "is-live")}
          />
        ))}
      </div>
      {viewNotes.map((n) => {
        const left = ((n.start - barStart) / vis) * 100;
        const width = (n.dur / vis) * 100;
        const top = ((hi - n.note) / span) * 68 + 10;
        return (
          <div
            key={n.id}
            className="lyra-clip-note"
            style={{ left: `${left}%`, width: `${Math.max(width, 1.4)}%`, top: `${top}%` }}
            title={noteName(n.note)}
          >
            {n.dur > 1.1 ? noteName(n.note) : ""}
          </div>
        );
      })}
      {notes.length === 0 ? <span className="lyra-clip-empty">empty take</span> : null}
      {liveIn ? <div className="lyra-clip-head" style={{ left: `${((liveStep - barStart + 0.12) / vis) * 100}%` }} /> : null}
    </div>
  );
}

export function GrooveBar() {
  const patch = useSynth((s) => s.patch);
  const setGroove = useSynth((s) => s.setGroove);
  const playing = useSynth((s) => s.groovePlaying);
  const countingIn = useSynth((s) => s.countingIn);
  const setPlaying = useSynth((s) => s.setGroovePlaying);
  const clickOn = useSynth((s) => s.clickOn);
  const setClickOn = useSynth((s) => s.setClickOn);
  const countIn = useSynth((s) => s.countIn);
  const setCountIn = useSynth((s) => s.setCountIn);
  const rec = useSynth((s) => s.recMode);
  const setRec = useSynth((s) => s.setRecMode);
  const playhead = useSynth((s) => s.grooveStep);
  const undo = useSynth((s) => s.undoGroove);
  const redo = useSynth((s) => s.redoGroove);
  const canUndo = useSynth((s) => s.grooveUndo.length > 0);
  const canRedo = useSynth((s) => s.grooveRedo.length > 0);
  const loadPhrase = useSynth((s) => s.loadPhrase);
  const loadBeat = useSynth((s) => s.loadBeat);
  const loadGroove = useSynth((s) => s.loadGroovePreset);
  const hitDrum = useSynth((s) => s.hitDrum);
  const clearNoteTrack = useSynth((s) => s.clearNoteTrack);
  const clearDrumLane = useSynth((s) => s.clearDrumLane);
  const userSequences = useSynth((s) => s.userSequences);
  const saveUserSequence = useSynth((s) => s.saveUserSequence);
  const renameUserSequence = useSynth((s) => s.renameUserSequence);
  const deleteUserSequence = useSynth((s) => s.deleteUserSequence);
  const loadUserSequence = useSynth((s) => s.loadUserSequence);
  const factory = useSynth((s) => s.factory);
  const userPatches = useSynth((s) => s.userPatches);
  const g = grooveOf(patch.groove);
  const patchOpts = useMemo(
    () => [
      ...factory.map((p) => ({ id: p.id, name: p.name, group: p.category })),
      ...userPatches.map((p) => ({ id: p.id, name: p.name, group: "User" })),
    ],
    [factory, userPatches],
  );
  const [viewBar, setViewBar] = useState(0);
  const [lib, setLib] = useState<"grooves" | "phrases" | "beats" | "user">("grooves");
  const [seqName, setSeqName] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const vis = STEPS_PER_BAR;
  const bars = g.bars;
  const start = Math.min(viewBar, Math.max(0, bars - 1)) * STEPS_PER_BAR;
  const idxs = useMemo(() => Array.from({ length: vis }, (_, i) => start + i), [vis, start]);
  const liveIdx = playing ? playhead : -1;

  useEffect(() => {
    setViewBar((b) => Math.min(b, Math.max(0, bars - 1)));
  }, [bars]);

  useEffect(() => {
    if (!playing || liveIdx < 0) return;
    setViewBar(Math.floor(liveIdx / STEPS_PER_BAR));
  }, [playing, liveIdx]);

  const put = (next: Groove) => setGroove(next);

  const toggleDrum = (part: DrumPart, i: number) => {
    const lane = g.drums[part].slice();
    const hit = lane[i] ?? { on: false, vel: 0.85 };
    lane[i] = { on: !hit.on, vel: hit.on ? hit.vel : 0.85 };
    put({ ...g, drums: { ...g.drums, [part]: lane } });
  };

  const showGrid = g.seqOn || g.drumsOn;

  return (
    <section className="lyra-groove" aria-label="Sequencer and drums">
      <div className="lyra-groove-transport">
        <Chip on={g.seqOn} onClick={() => put({ ...g, seqOn: !g.seqOn })}>
          Seq
        </Chip>
        <Chip on={g.drumsOn} onClick={() => put({ ...g, drumsOn: !g.drumsOn })}>
          Drums
        </Chip>
        <Chip on={playing || countingIn} onClick={() => setPlaying(!playing)} title={playing ? "Stop" : "Play loop"}>
          {playing ? <Square className="size-3.5" /> : <Play className="size-3.5" />}
          {countingIn ? "Count" : playing ? "Stop" : "Play"}
        </Chip>
        <Chip on={clickOn} onClick={() => setClickOn(!clickOn)} title="Metronome click on quarters">
          Click
        </Chip>
        <Chip on={countIn} onClick={() => setCountIn(!countIn)} title="1 bar count-in before Play">
          Count
        </Chip>
        <Chip on={rec === "wait"} onClick={() => setRec(rec === "wait" ? "off" : "wait")} title="Wait for first note">
          Wait
        </Chip>
        <Chip on={rec === "live"} onClick={() => setRec(rec === "live" ? "off" : "live")} title="Live overdub">
          <Circle className={cn("size-3", rec !== "off" && "fill-current")} />
          Rec
        </Chip>
        <Chip on={false} onClick={undo} title="Undo last change" disabled={!canUndo}>
          <Undo2 className="size-3.5" />
          Undo
        </Chip>
        <Chip on={false} onClick={redo} title="Redo" disabled={!canRedo}>
          <Redo2 className="size-3.5" />
          Redo
        </Chip>
        <select
          className="h-10 min-w-0 rounded-md bg-elevated px-2 text-sm text-fg"
          value={g.bars}
          onChange={(e) => put(withBars(g, Number(e.target.value)))}
          aria-label="Bars"
        >
          {Array.from({ length: MAX_BARS }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "bar" : "bars"}
            </option>
          ))}
        </select>
        <select
          className="h-10 min-w-0 rounded-md bg-elevated px-2 text-sm text-fg"
          value={g.kit}
          onChange={(e) => put({ ...g, kit: e.target.value as Groove["kit"] })}
          aria-label="Drum kit"
        >
          <option value="analog">Analog</option>
          <option value="tight">Tight</option>
          <option value="dust">Dust</option>
          <option value="industrial">Industrial</option>
        </select>
      </div>

      {bars > 1 ? (
        <div className="lyra-groove-scroll">
          <span className="lyra-groove-scroll-lab">Bar {barOf(start)}</span>
          <input
            type="range"
            min={0}
            max={bars - 1}
            step={1}
            value={Math.min(viewBar, bars - 1)}
            aria-label="Bar window"
            className="lyra-groove-slider"
            onChange={(e) => setViewBar(Number(e.target.value))}
          />
          <span className="lyra-groove-scroll-lab is-end">Bar {bars}</span>
        </div>
      ) : null}

      {showGrid ? (
        <>
          <div className="lyra-groove-row lyra-groove-bars">
            <span className="lyra-groove-k">Bar</span>
            <Grid count={vis}>
              {idxs.map((i) => (
                <div
                  key={i}
                  className={cn(
                    "lyra-bar-h",
                    tickOf(i) === 1 && beatOf(i) === 1 && "is-start",
                    liveIdx >= start && liveIdx < start + vis && tickOf(i) === 1 && beatOf(i) === 1 && "is-live",
                  )}
                >
                  {beatOf(i) === 1 && tickOf(i) === 1 ? barOf(i) : ""}
                </div>
              ))}
            </Grid>
          </div>
          <div className="lyra-groove-row lyra-groove-beats">
            <span className="lyra-groove-k">Beat</span>
            <Grid count={vis}>
              {idxs.map((i) => (
                <div
                  key={i}
                  className={cn("lyra-beat-h", tickOf(i) === 1 && "is-down", liveIdx === i && "is-live")}
                >
                  {tickOf(i) === 1 ? beatOf(i) : ""}
                </div>
              ))}
            </Grid>
          </div>
          <div className="lyra-groove-row lyra-groove-ticks">
            <span className="lyra-groove-k">16th</span>
            <Grid count={vis}>
              {idxs.map((i) => (
                <div key={i} className={cn("lyra-tick-h", liveIdx === i && "is-live")}>
                  {tickOf(i)}
                </div>
              ))}
            </Grid>
          </div>
        </>
      ) : null}

      {g.seqOn
        ? Array.from({ length: NOTE_TRACKS }, (_, t) => (
            <div key={t} className={cn("lyra-groove-row", g.mute[t] && "is-muted")}>
              <TrackHead
                label={`${t + 1}`}
                mute={Boolean(g.mute[t])}
                arm={Boolean(g.arm[t])}
                onMute={() => put(toggleMute(g, t))}
                onArm={() => put(toggleArm(g, t))}
                onClear={() => clearNoteTrack(t)}
                sound={
                  ["a", "b"].includes(g.trackSound[t] ?? "a") || patchOpts.some((p) => p.id === g.trackSound[t])
                    ? g.trackSound[t] ?? "a"
                    : "a"
                }
                sounds={patchOpts}
                onSound={(id) => put(setTrackSound(g, t, id))}
              />
              <ClipLane
                notes={g.tracks[t] ?? []}
                barStart={start}
                liveStep={liveIdx}
                armed={Boolean(g.arm[t] && rec !== "off")}
              />
            </div>
          ))
        : null}

      {g.drumsOn ? (
        <div className="lyra-groove-drums">
          {DRUM_PARTS.map((part) => (
            <div key={part} className={cn("lyra-groove-row", g.drumMute[part] && "is-muted")}>
              <TrackHead
                label={DRUM_LABEL[part]}
                mute={Boolean(g.drumMute[part])}
                arm={Boolean(g.drumArm[part])}
                onMute={() => put(toggleDrumMute(g, part))}
                onArm={() => put(toggleDrumArm(g, part))}
                onClear={() => clearDrumLane(part)}
                onPad={() => hitDrum(part)}
                padTitle={`Play ${DRUM_LABEL[part]}`}
              />
              <Grid count={vis}>
                {idxs.map((i) => {
                  const hit = g.drums[part][i];
                  return (
                    <button
                      key={i}
                      type="button"
                      className={cn(
                        "lyra-step",
                        hit?.on && (hit.vel > 0.92 ? "is-accent" : "is-gate"),
                        tickOf(i) === 1 && "is-beat",
                        liveIdx === i && "is-live",
                        g.drumArm[part] && rec !== "off" && "is-armed-cell",
                      )}
                      aria-pressed={Boolean(hit?.on)}
                      onClick={() => toggleDrum(part, i)}
                    />
                  );
                })}
              </Grid>
            </div>
          ))}
        </div>
      ) : null}

      <div className="lyra-groove-lib">
        {!g.seqOn && !g.drumsOn ? (
          <p className="mb-2 text-sm text-muted">Load a Groove, or turn Seq / Drums on — then Play.</p>
        ) : (
          <p className="mb-2 text-sm text-muted">
            Note tracks are takes — Rec captures what you play; C clears the whole take. Each track picks Layer A, Layer
            B, or any patch. Drums stay 16th pads — kick, snare, hats, clap, lo/hi tom, perc.
          </p>
        )}
        <div className="flex flex-wrap gap-1">
          {(["grooves", "phrases", "beats", "user"] as const).map((id) => (
            <Chip key={id} on={lib === id} onClick={() => setLib(id)}>
              {id === "grooves" ? "Grooves" : id === "phrases" ? "Phrases" : id === "beats" ? "Beats" : "User"}
            </Chip>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {lib === "grooves" &&
            GROOVES.map((x) => (
              <button
                key={x.id}
                type="button"
                className="h-9 rounded-md bg-elevated px-2.5 text-sm text-fg hover:text-accent"
                onClick={() => loadGroove(x.id)}
              >
                {x.name}
              </button>
            ))}
          {lib === "phrases" &&
            PHRASES.map((x) => (
              <button
                key={x.id}
                type="button"
                className="h-9 rounded-md bg-elevated px-2.5 text-sm text-fg hover:text-accent"
                onClick={() => loadPhrase(x.id)}
                title={x.group}
              >
                {x.name}
              </button>
            ))}
          {lib === "beats" &&
            BEATS.map((x) => (
              <button
                key={x.id}
                type="button"
                className="h-9 rounded-md bg-elevated px-2.5 text-sm text-fg hover:text-accent"
                onClick={() => loadBeat(x.id)}
                title={x.group}
              >
                {x.name}
              </button>
            ))}
        </div>
        {lib === "user" ? (
          <div className="mt-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={seqName}
                onChange={(e) => setSeqName(e.target.value)}
                placeholder="Name this sequence"
                className="h-10 flex-1 rounded-md bg-elevated px-3 text-sm text-fg placeholder:text-subtle"
              />
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-accent px-3 text-sm font-semibold text-accent-fg"
                onClick={() => {
                  saveUserSequence(seqName);
                  setSeqName("");
                }}
              >
                <Save className="size-3.5" />
                Save
              </button>
            </div>
            {userSequences.length > 0 ? (
              <ul className="mt-2 divide-y divide-border">
                {userSequences.map((u) => (
                  <li key={u.id} className="flex items-center gap-1 py-1.5">
                    {renameId === u.id ? (
                      <input
                        autoFocus
                        value={renameDraft}
                        aria-label={`Rename ${u.name}`}
                        className="h-9 min-w-0 flex-1 rounded-md bg-elevated px-2 text-sm text-fg"
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onBlur={(e) => {
                          if (e.currentTarget.dataset.cancel === "1") return;
                          renameUserSequence(u.id, renameDraft);
                          setRenameId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            renameUserSequence(u.id, renameDraft);
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
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left text-sm hover:text-accent"
                        onClick={() => loadUserSequence(u.id)}
                      >
                        {u.name}
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={`Rename ${u.name}`}
                      className="grid size-9 shrink-0 place-items-center rounded-md text-muted hover:text-fg"
                      onClick={() => {
                        setRenameId(u.id);
                        setRenameDraft(u.name);
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${u.name}`}
                      className="grid size-9 shrink-0 place-items-center rounded-md text-muted hover:text-fg"
                      onClick={() => deleteUserSequence(u.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">No saved sequences yet.</p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
