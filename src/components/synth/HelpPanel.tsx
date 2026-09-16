import { useEffect, useRef, useState, type ReactNode } from "react";
import { CircleHelp, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useSynth } from "@/lib/synth/store";
import { LayerBrand } from "./LayerStrip";
import { DawSetup } from "./DawPanel";

const TABS = [
  { id: "start", label: "Start" },
  { id: "live", label: "Live" },
  { id: "play", label: "Play" },
  { id: "sound", label: "Sound" },
  { id: "arp", label: "Arp" },
  { id: "studio", label: "Studio" },
  { id: "daw", label: "MIDI/DAW" },
  { id: "faq", label: "FAQ" },
  { id: "about", label: "About" },
] as const;

type Tab = (typeof TABS)[number]["id"];

/** Trap wheel/touch so a modal that is fully on-screen does not scroll the synth behind it. */
export function useOverlayScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const html = document.documentElement;
    html.classList.add("lyra-modal-open");
    const block = (e: WheelEvent | TouchEvent) => {
      const node = e.target instanceof Element ? e.target.closest("[data-modal-scroll]") : null;
      if (!(node instanceof HTMLElement)) {
        e.preventDefault();
        return;
      }
      const slack = node.scrollHeight - node.clientHeight;
      if (slack <= 1) {
        e.preventDefault();
        return;
      }
      if (!(e instanceof WheelEvent)) return;
      const atTop = node.scrollTop <= 0 && e.deltaY < 0;
      const atBot = node.scrollTop + node.clientHeight >= node.scrollHeight - 1 && e.deltaY > 0;
      if (atTop || atBot) e.preventDefault();
    };
    document.addEventListener("wheel", block, { passive: false });
    document.addEventListener("touchmove", block, { passive: false });
    return () => {
      html.classList.remove("lyra-modal-open");
      document.removeEventListener("wheel", block);
      document.removeEventListener("touchmove", block);
    };
  }, [active]);
}

export function HelpPanel() {
  const open = useSynth((s) => s.helpOpen);
  const setHelpOpen = useSynth((s) => s.setHelpOpen);
  const [tab, setTab] = useState<Tab>("start");
  useOverlayScrollLock(open);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-bg/80 p-3 backdrop-blur-sm sm:p-4">
      <div
        role="dialog"
        aria-labelledby="help-title"
        className="lyra-help flex max-h-[92dvh] w-full max-w-4xl shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-panel"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <CircleHelp className="size-5 text-accent" />
          <h2 id="help-title" className="font-display text-lg font-bold tracking-wide text-fg">
            LYRA-32 help
          </h2>
          <p className="hidden text-sm text-muted sm:block">Press ? anytime · Esc to close</p>
          <button
            type="button"
            className="ml-auto grid size-10 place-items-center rounded-md bg-elevated text-muted hover:text-fg"
            aria-label="Close help"
            onClick={() => setHelpOpen(false)}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex shrink-0 flex-wrap gap-1 border-b border-border px-3 py-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "h-10 rounded-md px-3 text-sm font-semibold",
                tab === t.id ? "bg-accent text-accent-fg" : "bg-elevated text-muted hover:text-fg",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative min-h-0 overflow-hidden">
          <div className={cn("px-5 py-4", tab !== "play" && "invisible")} aria-hidden={tab !== "play"}>
            <PlayTab />
          </div>
          {tab !== "play" && (
            <div className="absolute inset-0 overflow-y-auto overscroll-contain px-5 py-4" data-modal-scroll>
              {tab === "start" && <StartTab />}
              {tab === "live" && <LiveTab />}
              {tab === "sound" && <SoundTab />}
              {tab === "arp" && <ArpTab />}
              {tab === "studio" && <StudioTab />}
              {tab === "daw" && <DawSetup />}
              {tab === "faq" && <FaqTab />}
              {tab === "about" && <AboutTab />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function H({ children }: { children: string }) {
  return <h3 className="lyra-cell-title mb-2 mt-4 first:mt-0">{children}</h3>;
}

function P({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-[0.95rem] leading-relaxed text-muted">{children}</p>;
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded-sm bg-elevated px-1.5 py-0.5 font-mono text-sm text-fg">{children}</kbd>
  );
}

function Ul({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mb-3 list-disc space-y-1.5 pl-5 text-[0.95rem] leading-relaxed text-muted">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

function BackupRestoreRow() {
  const exportBackup = useSynth((s) => s.exportBackup);
  const importBackup = useSynth((s) => s.importBackup);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      <button
        type="button"
        className="h-10 rounded-md bg-elevated px-4 text-sm font-semibold text-muted hover:text-fg"
        onClick={() => exportBackup()}
      >
        Backup
      </button>
      <button
        type="button"
        className="h-10 rounded-md bg-elevated px-4 text-sm font-semibold text-muted hover:text-fg"
        onClick={() => ref.current?.click()}
      >
        Restore
      </button>
      <input
        ref={ref}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          if (!window.confirm("Replace scenes, MIDI maps, and user patches in this browser with this backup?")) return;
          void file.text().then((t) => {
            try {
              const ok = importBackup(JSON.parse(t));
              if (!ok) window.alert("That file is not a LYRA backup.");
            } catch {
              window.alert("That file is not a LYRA backup.");
            }
          });
        }}
      />
    </div>
  );
}

function StartTab() {
  return (
    <>
      <H>30-second start</H>
      <Ul
        items={[
          <>Click any piano key, or press <Kbd>A</Kbd>. The first gesture unlocks the browser audio engine — then it stays live.</>,
          <>Pick a sound from the patch menu in the header, or from Library below the faceplate.</>,
          <>Play. If it is silent, look at Live (must be gold), Mute (must not be gold), and Panic if a note is stuck.</>,
          <>Plug a USB-C MIDI keyboard. Chrome will ask for MIDI permission — Allow.</>,
          <>Hide the on-screen piano with the keyboard icon once the M-Audio (or any controller) is connected.</>,
        ]}
      />
      <H>What you are looking at</H>
      <P>
        LYRA-32 is a 32-voice hybrid synth: two oscillators, sub, noise, a multimode filter, dual envelopes, two LFOs, a 4-slot
        modulation matrix, an arpeggiator with a 16-step pattern, and an FX rack.
      </P>
      <P>
        Knobs: click and drag <strong className="text-fg">vertically</strong>. Mouse up turns the knob clockwise. Gold
        nameplates (Ring, Delay, LFO Depth, …) are on/off — click to bypass, click again to restore the last amount. Double-click a
        knob (when it has a default) to reset it.
      </P>
      <H>Header</H>
      <Ul
        items={[
          <>Left: Vol (master, not in the patch — CK volume / CC7). Transpose (− / + / click the number to reset). Mac: Learn, Live/Idle. iPad: Learn is in ⋯. MIDI name is Help → MIDI/DAW.</>,
          <>Centre: scope + voice count (notes sounding, including releases).</>,
          <>Right: Tap tempo, BPM, Octave (<Kbd>Z</Kbd> / <Kbd>X</Kbd>), keyboard icon, Mute, Wav, Fullscreen, Stage, Help (?), Panic (Esc).</>,
        ]}
      />
      <P>
        Gold = on. The easy-to-forget gestures (scenes, Learn, Stage, Shape, groove Click) live in the <strong className="text-fg">Live</strong> tab
        — open that before a set.
      </P>
    </>
  );
}

function LiveTab() {
  return (
    <>
      <H>Read this before a set</H>
      <P>
        This tab is the cheat sheet. Mac has no Alt key — use <strong className="text-fg">Option</strong> or a two-finger click.
      </P>
      <H>Scenes (8 pads under the layers)</H>
      <Ul
        items={[
          <>Empty pad — click to store this sound + both layers + the groove.</>,
          <>Filled pad — click to recall. Gold = the last one you recalled.</>,
          <>Double-click a filled pad to name it (Verse, Drop…). Names show on the pad.</>,
          <>Shift-click — overwrite that pad with what’s playing now (keeps the name).</>,
          <>Clear — Option-click, Control-click, or right-click / two-finger click.</>,
          <>Computer keys <Kbd>1</Kbd>–<Kbd>8</Kbd> recall. Shift+number stores. Not while typing in a name field.</>,
          <>Scenes are saved in this browser. They survive refresh. They do not follow you to another computer.</>,
        ]}
      />
      <H>Store / A/B</H>
      <Ul
        items={[
          <>Store freezes “right now” as the B side (session only — gone after refresh).</>,
          <>A/B flips stored vs now. Use it for “did I ruin the sound?” not as a numbered scene.</>,
          <>Click Store first, then A/B. If A/B does nothing, you have not stored yet.</>,
        ]}
      />
      <H>Morph</H>
      <P>
        Pick two filled scenes, drag the slider. Knobs (cut, levels, FX, envelopes…) blend. Waves and the groove jump at
        50%. Empty slots do nothing. Morph writes the faceplate — it does not overwrite the stored pads until you Shift-click
        save.
      </P>
      <H>XY pad</H>
      <P>Cut on X (left→right), Res on Y (bottom→top). Same as those two knobs. One finger for filter sweeps.</P>
      <H>Learn (MIDI)</H>
      <Ul
        items={[
          <>Header Learn gold → click a knob (gold ring) → move a CK88 fader/knob. That CC now owns the knob.</>,
          <>Learn stays on so you can map several knobs. Click Learn again to finish.</>,
          <>Maps are saved in this browser. CC64 is always sustain. Unmapped CC1 / CC74 still open cutoff.</>,
          <>Mapped CCs move the actual knob (saved in the patch). The mod-wheel needle on Cut is separate — that is CC1 when not remapped.</>,
          <>CK volume / CC7 moves header Vol (not the old Out, which is hidden in the patch).</>,
        ]}
      />
      <P>
        Keyboard name and ports live in <strong className="text-fg">MIDI/DAW</strong> — open that tab if the CK is silent.
      </P>
      <H>Stage</H>
      <P>
        Gold = keep this tab awake (screen + audio). Off after refresh. Leave it off at home on 8 GB — it stops Chrome
        napping the tab. Turn it on before a set, not all day.
      </P>
      <H>Wav bounce</H>
      <Ul
        items={[
          <>Wav gold = recording the master output (what you hear).</>,
          <>Click again to stop and download a .wav (stereo, up to 3 minutes).</>,
          <>Play, then record. Silence records silence. Panic does not stop the bounce — click Wav again.</>,
        ]}
      />
      <H>Fullscreen</H>
      <P>The expand icon next to Wav. Esc leaves fullscreen (and Panic is also Esc — leave fullscreen first if you only meant to un-full-screen).</P>
      <H>Shape</H>
      <Ul
        items={[
          <>Arm must be gold or you hear nothing from the curve. Silk is the default swell, starting at 15%.</>,
          <>Sh 1 and Sh 2 are two independent curves. Typical live: Sh 1 → Amp, Sh 2 → Cut.</>,
          <>Click a dest (Amp, Cut, Pos…). Shift-click a dest for a second target on the same curve (gold outline).</>,
          <>From is a floor under the whole curve, 0–100%. Time is the length of the shape. Depth is how far it moves.</>,
          <>Env = once per note. Loop = repeats while notes are held. Dest = what the curve moves.</>,
        ]}
      />
      <H>Wavetable drop</H>
      <P>
        Drag a .wav onto the Table / Live panes. It becomes the User table (16 frames from the file). Lasts until you
        refresh — drop it again if you need it after a reload. Osc wave must be Tbl to hear it.
      </P>
      <H>Groove click / count-in</H>
      <Ul
        items={[
          <>Click — metronome on quarter notes while the loop runs (accent on bar 1).</>,
          <>Count — 1 bar of four clicks, then Play starts. Click Stop during the count-in to cancel.</>,
          <>Turn Seq and/or Drums on, or Play will arm both so you hear something.</>,
        ]}
      />
      <H>Easy to forget (everything else)</H>
      <Ul
        items={[
          <>First click or key unlocks Chrome audio. Live must be gold. Mute must not be gold.</>,
          <>Knobs drag vertically. Double-click a knob to reset. Gold nameplate (Delay, Ring, Drive…) = bypass; click again to restore the last amount.</>,
          <>Mod wheel opens cutoff; the Cut knob itself does not move — watch the gold needle and the meter beside Cut.</>,
          <>Panic / Esc kills stuck notes, arp latch, aftertouch, mod. It is not Mute.</>,
          <>Transpose click the number to 0. Octave is Z / X and the header C3 display.</>,
          <>Hold on the arp latches the chord. All keys up, then a new chord, replaces it.</>,
          <>User patches, favorites, MIDI maps, and scenes live in this browser only. Backup / Restore below (or in Library) downloads them as a file.</>,
        ]}
      />
      <BackupRestoreRow />
    </>
  );
}

function PlayTab() {
  return (
    <>
      <H>On-screen piano</H>
      <P>Three octaves. Octave / transpose in the header move the sounding pitch; the keys stay put, like a small controller with an octave button.</P>
      <H>Computer keyboard</H>
      <P>
        Two rows, <Kbd>A</Kbd> is C of the current octave. Black keys sit on <Kbd>W</Kbd> <Kbd>E</Kbd> <Kbd>T</Kbd>{" "}
        <Kbd>Y</Kbd> <Kbd>U</Kbd> <Kbd>O</Kbd> <Kbd>P</Kbd>.
      </P>
      <Ul
        items={[
          <>White: A S D F G H J K L ; '</>,
          <>Octave down / up: Z / X — same octave as USB MIDI. Changing octave while a key is held will not stick a note.</>,
          <>Panic: Esc. Help: ?. Number keys <Kbd>1</Kbd>–<Kbd>8</Kbd> are scenes, not notes. Sliders do not steal the piano keys.</>,
          <>Typing in Search / Rename / Save still uses the text field, not notes.</>,
        ]}
      />
      <H>USB MIDI</H>
      <Ul
        items={[
          <>Class-compliant keyboards (M-Audio, etc.) over USB-C. Chrome, Edge, or Firefox. Not Safari.</>,
          <>Allow MIDI when the browser asks. Status shows the port name when it is connected.</>,
          <>Pitch wheel bends sounding notes ±2 semitones. Mod wheel (CC1) and CC74 open cutoff — the Cut knob stays put; a gold needle and the Mod meter next to it follow the wheel. CC7 is volume. CC64 sustain. Learn can steal any other CC for a knob.</>,
          <>Channel or poly aftertouch feeds matrix source AT — route it to cutoff, pitch, amp, and so on.</>,
        ]}
      />
      <H>Voice modes (Mixer plate)</H>
      <Ul
        items={[
          <>Poly — up to 32 overlapping notes. Oldest voice is stolen if you exceed that.</>,
          <>Mono — one note, each new key retriggers the envelopes.</>,
          <>Leg (legato) — Yamaha-style: overlapping keys do not retrigger. Glide only if Glide is up. Last-note priority.</>,
        ]}
      />
    </>
  );
}

function SoundTab() {
  return (
    <>
      <H>Oscillators</H>
      <P>
        Osc 1 and Osc 2: Sine, Tri, Saw, Square, Pulse (width = PWM), Super (7-detuned saws), Table (wavetable).
        The Wavetable plate: pick a table, scan with Pos. Warp (Bend / Sync / Flip / Fold / Bit) is Serum-style.
        Form shifts the formant, Tone tilts the spectrum, Phase rotates the cycle. PWM on the osc is Pos when Tbl is on.
      </P>
      <H>Mixer</H>
      <Ul
        items={[
          <>Sub — sine one octave under Osc 1. Noise — white noise into the filter.</>,
          <>Uni / Det / Spr — Off plus 2–7 unison voices, detune, stereo spread. Super already has its own detune.</>,
          <>Drive — tanh saturation after the mix, before the filter.</>,
          <>Ring — Osc 2 multiplies Osc 1 (bells, clang). Sync — Osc 2 hard-syncs Osc 1 (screams).</>,
          <>FM — Osc 2 modulates Osc 1 pitch. Drift — slow analog-style pitch wander.</>,
          <>Glide — portamento time, heard in Mono / Legato.</>,
        ]}
      />
      <H>Filter</H>
      <P>
        LP / HP / BP / Notch, 12 or 24 dB/oct. Cut, Res, Env (filter envelope amount), Tone (tilt: left darker, right
        brighter — cutoff stays put), Key (higher notes brighter), Vel (velocity opens cutoff). Amp EG Vel is velocity to
        loudness.
      </P>
      <H>Envelopes</H>
      <P>Amp EG is loudness ADSR. Filter EG is the filter ADSR. Times are in milliseconds under 1 s, then seconds.</P>
      <H>LFOs</H>
      <P>
        Two global LFOs. Rate, Depth, and Fade (rise time) are sliders. Dest: Cut, Pitch, Pan, Amp, Res, FM. Wave: sine,
        tri, saw, square, S&H (stepped random). Rate changes apply live; dest is sampled at note-on.
      </P>
      <H>Shape (drawn LFO)</H>
      <P>
        Plate under Wavetable. Drag on the graph to draw a curve, like Serum 2 / Vital. Env plays it once per note; Loop
        repeats. Time is the length of the whole shape (seconds). From is a floor (0–100%) under the whole curve — it
        stays the same shape, just never goes below that. Silk / Lift / Glow / Rush set 15%; Spike, Gate, Trem, Warp and
        the other chops snap it back to 0. 100% is a flat full line. Depth is how far it moves the destination. Dest: Amp
        (volume swell), Cut, Pos, Pitch, Pan, Drive, FM — click for dest, Shift-click for a second dest (gold outline). Sh
        1 / Sh 2 are two independent curves (live: Shape 1 Amp, Shape 2 Cut). Arm to hear it.
      </P>
      <H>Matrix</H>
      <P>Six extra routes, stacked on the LFO plates. Sources and destinations:</P>
      <Ul
        items={[
          <>Src: LFO1, LFO2, FEG (filter envelope), Vel (note velocity), Mod (mod wheel), AT (aftertouch), Key (low→high), Rnd (per note).</>,
          <>Dst: Cut, Pitch, Pan, Amp, Res, FM, PWM, Mix (osc 1↔2), Drv, FX send, Gld (glide).</>,
          <>Amt is bipolar (−100 to +100). Amounts near zero are ignored.</>,
        ]}
      />
      <H>FX</H>
      <P>Delay (mix / time / feedback), Reverb, Chorus, Phaser. Mix knobs are wet amount. Delay time is in milliseconds.</P>
    </>
  );
}

function ArpTab() {
  return (
    <>
      <H>Arpeggiator</H>
      <Ul
        items={[
          <>On — held notes are sequenced instead of played as a chord.</>,
          <>Hold — latches the last chord after you lift your hands. Play a new chord (all keys up, then down) to replace it.</>,
          <>Mode: Up, Dn, U/D, Rnd (shuffle once per cycle), Ord (order played).</>,
          <>BPM, Gate (note length), Swing (even steps late), Oct (1–3 octaves), rate 1/4 … 1/16t.</>,
          <>Tap (header, next to the voice count) — hit it twice or more in time. Averages the last taps into BPM (60–180). DAW clock still wins while Clock is following.</>,
        ]}
      />
      <H>Sequencer + drums</H>
      <P>
        Groove plate under Pattern. Clock is 4/4: 1 bar = 4 beats, 1 beat = 4 sixteenths. Length is 1–8 bars. Four note
        tracks are MIDI takes — Rec / Wait capture whatever you play for the loop, like a vocal; C clears the whole take
        (no per-16th delete). Each note track picks its own sound: Layer A, Layer B, or any patch from the bank. Drums
        stay an 8-lane 16th grid (kick, snare, hats, clap, lo/hi tom, perc). M mutes anytime; R arms for rec. Save the
        sequence under User — name it, rename, or delete, same as a patch. Factory Grooves land on track 1; Phrases load
        into armed note tracks. C1–D#2 paint armed drum lanes while Rec is on (F1–D2 are the toms). Undo / Redo step
        through rec takes, clears, and factory loads. Click = quarter-note metronome while playing. Count = 1 bar of
        clicks, then the loop starts (Stop cancels the count-in). Wav in the header records the output to a file.
      </P>
      <H>16-step pattern</H>
      <P>
        Pattern arms the arp and overlays a 16-step gate on top of the note order. Gold step = playhead. Click a step to cycle:
      </P>
      <Ul
        items={[
          <>Empty — rest (skip).</>,
          <>Dim gold — gate (play).</>,
          <>Bright + • — accent (harder velocity).</>,
          <>+1 — play one octave up.</>,
          <>−1 — play one octave down.</>,
        ]}
      />
      <P>
        Rests still advance the clock, so a pattern like x.x.x.x. is a 1/8 feel at 1/16 rate. Try factory patch Techno Seq.
      </P>
      <H>DAW clock</H>
      <P>
        Open DAW, turn Clock on. When Ableton or Logic sends MIDI clock, BPM follows 24 PPQN. Transport stop returns the arp to
        the patch tempo. Keep this tab visible for a stable clock.
      </P>
    </>
  );
}

function StudioTab() {
  return (
    <>
      <H>Two layers</H>
      <P>
        Cards A and B under the header. Gold outline is the layer the faceplate edits. Power mutes a layer. Load a second
        factory or user patch into B, then Stack (both on every key) or Split (A below the split note, B above). Level and pan
        are per layer. Arp, pattern, and FX stay shared. 32 voices are shared — both layers on is about 16-note poly. Save
        writes the whole stack into User.
      </P>
      <H>Library</H>
      <Ul
        items={[
          <>271 factory patches: core roles plus 100 era sounds (20 each for 2022–2026 — phonk, Jersey, Brat, Amapiano, botanica, jerk, and the rest of the last five years). Star a patch for Favorite.</>,
          <>Star a patch to drop it in Favorite. The header star is the same list.</>,
          <>Name this patch + Save writes a User copy in this browser (localStorage).</>,
          <>Pencil to rename a user patch, trash to delete. Factory names cannot be renamed.</>,
        ]}
      />
      <H>Ableton / Logic</H>
      <P>
        LYRA is a browser instrument, not a VST/AU. Route MIDI out of the DAW into LYRA via the IAC Driver, then optionally
        return audio with BlackHole. The DAW button walks through both apps.
      </P>
      <H>Suggested first patches</H>
      <Ul
        items={[
          <>Keys — Init Dual Saw (the template).</>,
          <>Lead — Scream Super, Howl Super, Chorus Lead, Halo Lead.</>,
          <>Bass — Sub Current.</>,
          <>Sequence — Techno Seq (pattern + hold already on).</>,
        ]}
      />
    </>
  );
}

function FaqTab() {
  return (
    <>
      <H>Backup</H>
      <P>
        Downloads scenes, MIDI maps, user patches, favorites, and sequences as a JSON file. Keep a copy on the Mac.
        Restore replaces what is in this browser with that file. Store / A/B is not in the backup. Same buttons live in
        Library.
      </P>
      <BackupRestoreRow />
      <H>No sound</H>
      <Ul
        items={[
          <>Click a key once — browsers block audio until a gesture. Live should read gold.</>,
          <>Mute gold? Click it. Master or Osc levels at 0? Amp sustain at 0 with a long attack?</>,
          <>YouTube can play while Chrome still has this tab muted in the tab bar — unmute the tab.</>,
        ]}
      />
      <H>Stuck notes</H>
      <P>
        Panic (or Esc) kills every voice, clears the arp latch, and zeroes aftertouch / mod. That is what it is for — not a
        volume control.
      </P>
      <H>MIDI not seen</H>
      <P>Chrome / Edge / Firefox on Mac. Allow MIDI. Re-plug the keyboard. DAW → All inputs, or pick the IAC bus only.</P>
      <H>Why not a plugin?</H>
      <P>
        Web Audio cannot load as VST/AU. Use DAW mode (IAC MIDI + optional BlackHole audio). Same sound, different wiring.
      </P>
    </>
  );
}

function AboutTab() {
  return (
    <>
      <H>LYRA-32</H>
      <P>
        by Ray Bridge Digital · Mk V.6 · Version 5.6. 32-voice hybrid synthesizer for Chrome, Edge, and Firefox. Dual
        oscillator + sub + noise, dual LFO, 6-slot matrix, FX rack, arpeggiator with 16-step pattern, two-layer stack /
        split, a groovebox, drawn Shape (×2), scenes, MIDI learn, and bounce-to-wav. USB-C MIDI, computer keys, or the
        on-screen piano. Not a VST/AU — DAW mode uses IAC MIDI. Open Help → Live for the stage cheat sheet.
      </P>
      <H>Backup</H>
      <BackupRestoreRow />
      <div className="lyra-about-brand">
        <LayerBrand />
      </div>
    </>
  );
}
