import { Cable, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { isIacPort } from "@/lib/synth/midi";
import { useSynth } from "@/lib/synth/store";
import { useOverlayScrollLock } from "./HelpPanel";

export function DawPanel() {
  const open = useSynth((s) => s.dawOpen);
  const setDawOpen = useSynth((s) => s.setDawOpen);
  const ports = useSynth((s) => s.midiPorts);
  const midiPortId = useSynth((s) => s.midiPortId);
  const setMidiPort = useSynth((s) => s.setMidiPort);
  const clockBpm = useSynth((s) => s.clockBpm);
  const clockRunning = useSynth((s) => s.clockRunning);
  const clockFollow = useSynth((s) => s.clockFollow);
  const setClockFollow = useSynth((s) => s.setClockFollow);
  const midiStatus = useSynth((s) => s.midiStatus);
  useOverlayScrollLock(open);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-bg/80 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-labelledby="daw-title"
        className="max-h-[min(90dvh,40rem)] w-full max-w-3xl overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface p-5 shadow-panel"
        data-modal-scroll
      >
        <div className="mb-4 flex items-center gap-2">
          <Cable className="size-5 text-accent" />
          <h2 id="daw-title" className="font-display text-lg font-bold tracking-wide text-fg">
            DAW mode
          </h2>
          <button
            type="button"
            className="ml-auto grid size-10 place-items-center rounded-md bg-elevated text-muted hover:text-fg"
            aria-label="Close DAW setup"
            onClick={() => setDawOpen(false)}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section>
            <h3 className="lyra-cell-title">MIDI port</h3>
            <p className="mb-2 text-sm text-muted">
              Pick the IAC bus Ableton or Logic is sending to. Hardware keys still work if you leave this on All.
            </p>
            <select
              aria-label="MIDI input port"
              className="h-11 w-full rounded-lg bg-elevated px-3 text-base text-fg"
              value={midiPortId}
              onChange={(e) => setMidiPort(e.target.value)}
            >
              <option value="all">All inputs</option>
              {ports.map((p) => (
                <option key={p.id} value={p.id}>
                  {isIacPort(p.name) ? `IAC · ${p.name}` : p.name}
                </option>
              ))}
            </select>
            {midiStatus === "none" && (
              <p className="mt-2 text-sm text-muted">No MIDI ports yet. Enable IAC Driver in Audio MIDI Setup, then reopen this panel.</p>
            )}
            {midiStatus === "denied" && (
              <p className="mt-2 text-sm text-muted">MIDI permission blocked. Allow MIDI for this site in Chrome, then reload.</p>
            )}
            {midiStatus === "unsupported" && (
              <p className="mt-2 text-sm text-muted">This browser has no Web MIDI. Use Chrome or Edge on Mac.</p>
            )}

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setClockFollow(!clockFollow)}
                className={cn(
                  "h-11 rounded-md px-4 text-sm font-semibold",
                  clockFollow ? "bg-accent text-accent-fg" : "bg-elevated text-muted",
                )}
              >
                Clock {clockFollow ? "on" : "off"}
              </button>
              <div className="font-mono text-sm tabular-nums text-fg">
                {clockBpm != null ? `${clockBpm} BPM` : "— BPM"}
                <span className={cn("ml-2", clockRunning ? "text-accent" : "text-muted")}>
                  {clockRunning ? "running" : "stopped"}
                </span>
              </div>
            </div>
            <p className="mt-2 text-sm text-muted">
              When Clock is on, the arpeggiator follows the DAW MIDI clock (24 PPQN). Keep this tab visible for a stable tempo.
            </p>
          </section>

          <section className="space-y-4 text-sm text-fg">
            <div>
              <h3 className="lyra-cell-title">macOS IAC</h3>
              <ol className="list-decimal space-y-1 pl-5 text-muted">
                <li>Open Audio MIDI Setup → Window → Show MIDI Studio.</li>
                <li>Double-click IAC Driver → enable Device is online.</li>
                <li>Keep at least one bus named Bus 1.</li>
              </ol>
            </div>
            <div>
              <h3 className="lyra-cell-title">Ableton Live</h3>
              <ol className="list-decimal space-y-1 pl-5 text-muted">
                <li>Settings → Link, Tempo & MIDI.</li>
                <li>Output IAC Driver Bus 1: Track On, Sync On (sends MIDI + clock).</li>
                <li>MIDI track: MIDI To = IAC Driver Bus 1.</li>
                <li>Optional audio back: BlackHole as Chrome output, audio track input = BlackHole.</li>
              </ol>
            </div>
            <div>
              <h3 className="lyra-cell-title">Logic Pro</h3>
              <ol className="list-decimal space-y-1 pl-5 text-muted">
                <li>Logic Pro → Settings → MIDI → Sync: destination IAC Driver Bus 1, clock on.</li>
                <li>Instrument track → MIDI FX or External Instrument is not required — set the track’s MIDI output to IAC Bus 1 (Environment / MIDI Out, or a dummy External Instrument MIDI dest).</li>
                <li>Simpler path: External Instrument plugin, MIDI Destination = IAC Driver Bus 1. Leave audio input empty unless using BlackHole.</li>
                <li>Play the track — notes and clock hit LYRA in Chrome.</li>
              </ol>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
