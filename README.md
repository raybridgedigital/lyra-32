# LYRA-32 Mk V.5

Hybrid polyphonic web synthesizer by [Raybridge Digital](https://github.com/raybridgedigital).

Play from a class-compliant USB-C MIDI keyboard, the computer keys (A–L), or the on-screen piano. Chrome / Edge / Firefox.

**Play it:** [raybridgedigital.github.io/lyra-32](https://raybridgedigital.github.io/lyra-32/) (GitHub Pages — open in a full Chrome tab).

This tag is the restore point **with** iPad MIDIWeb header, Panic/Tap flash, iPad pitch-bend ignored.

## Mk V.5 (v5.5)

- iPad header: ⋯ (Wav/Stage/Help), Panic on the right, extra top inset for MIDIWeb fullscreen
- Tap and Panic flash gold on press (all devices)
- iPad ignores pitch-bend MIDI (keys + sustain still work)
- Android voice cap 12 (Mac/iPad still 32)
- Restore: `git checkout v5.5.0`

## Mk V.4 (v5.4.1)

- iPad / MIDIWeb: HTML audio tap so iPad speakers and CK USB audio work (Mac path unchanged)
- Ignore truncated pitch-bend (MIDIWeb no longer slams pitch down)
- 44.1 kHz on iPad; a few ms more latency than Mac Chrome USB is expected
- Restore: `git checkout v5.4.1`

## Mk V.4 (v5.4.0)

- First iPad speakers / CK USB audio freeze
- Restore: `git checkout v5.4.0`

## Mk V.3 (v5.3)

- GitHub Pages: https://raybridgedigital.github.io/lyra-32/
- DAW → Audio output / Choose output (Chrome speaker list when the tab allows it)
- Help Backup / Restore
- Restore: `git checkout v5.3.0`

## Mk V.2 (v5.2)


## Mk V.2 (v5.2)

- 8 named scene pads, Store / A/B, morph slider, XY Cut×Res
- Bounce: Wav in the header records the output
- Fullscreen, groove Click / Count-in
- Library Backup / Restore (scenes, maps, user patches)
- Help → Live tab (Mac Option / two-finger clear, what survives refresh)
- Restore: `git checkout v5.2.0`

## Mk V.1 (v5.1)

Hybrid polyphonic web synthesizer by [Raybridge Digital](https://github.com/raybridgedigital).

Play from a class-compliant USB-C MIDI keyboard, the computer keys (A–L), or the on-screen piano. Chrome / Edge / Firefox.

This tag is the restore point **with** scenes, MIDI learn, Shape 2, wav drop, and Stage keep-awake.

## Mk V.1 (v5.1)

- 8 scene pads (store / recall sound + groove). Keys 1–8, Shift stores, Alt clears
- MIDI Learn: map CK88 CCs to knobs (saved in the browser)
- Stage: keep the tab awake (off by default)
- Shape 2 + Shift-click second dest on the same curve
- Drop a `.wav` on the wavetable → User table
- Header: DAW / Learn on the left, voice count next to the scope, Panic stays visible
- Restore: `git checkout v5.1.0`

## Mk V (v5.0)

- Shape plate under Wavetable: draw a curve, Env (one-shot) or Loop, Time / From / Depth
- Dest Amp, Cut, Pos, Pitch, Pan, Drive, FM — Serum 2 / Vital style
- Factory shapes: Silk, Lift, Glow, Rush, Zig, Step, Snap, Pluck, Hold, Fall, Arc, Dip, Pulse, Spike, Trem, Gate, Chop, Warp
- From is a floor under the whole curve (0–100%); Amp swell starts on the curve (no delay leak)
- All 12 wavetable names visible (Classic → Grit)
- Restore: `git checkout v5.0.0`

## Mk IV.6 (v4.6)

- Wavetable plate (full width, under Pattern): 12 tables, stacked-frame view, triggered live scope
- Warp modes Bend / Sync / Mirror / Fold / Quant, plus Formant, Tone, Phase
- Header scope: filled 2-cycle triggered wave
- Filter Cut mod meter sits with the Cut knob
- Restore: `git checkout v4.6.0`

## Mk IV.5 (v4.5)

- Filter plate: 2-row knobs, Tone tilt, live Mod meter + gold needle for CC1/CC74
- Matrix 6 slots, extra dests (PWM, mix, drive, FX, glide), sources Key/Rnd, LFO S&H + fade-in
- Unison 1–7, Amp EG Vel
- 100 era factory sounds (20 each 2022–2026): phonk, Jersey, Brat, Amapiano, botanica, jerk
- Library A–Z; layer patch menu grouped by category with gold headers
- 271 factory patches
- Restore: `git checkout v4.5.0`

## Mk IV.4 (v4.4)

- Restored the full factory bank (GitHub `main` had truncated `patches.ts`)
- Five new patches: Rhodes Tine, Vowel Drift, Glide PWM, Mbira Tines, Muted Horn
- Restore: `git checkout v4.4.0`

## Mk IV.3 (v4.3)

- Groove plate under Pattern: 4 note tracks as continuous MIDI takes, 8 drum lanes (kick, snare, hats, clap, lo/hi tom, perc)
- Per-track sound (Layer A, Layer B, or any patch) — four different sounds at once
- Mute / rec-arm anytime; C clears a whole take or drum lane
- Length 1–8 bars; Bar / Beat / 16th headers; bar slider
- Analog / Tight / Dust / Industrial kits
- Undo / Redo stacks (rec, clears, factory loads)
- User sequences: save, rename, delete (same as patches)
- Factory grooves, phrases, 40 beats
- Restore: `git checkout v4.3.0`

## Mk IV.2 (v4.2)

- Dual-layer stack / split (A + B), independent patches, level / pan, mute that actually silences
- Logo plate + *by Ray Bridge Digital*
- Tap tempo (header) + BPM readout; arp Tempo knob
- Global octave (USB MIDI + computer keys + on-screen piano) and transpose (−24…+24)
- Layer A/B pan click-reset; Help → About
- Restore: `git checkout v4.2.0`

## Mk IV.1 (v4.1)

- In-app Help (`?` or header). Window is locked to the Play tab size; longer pages scroll inside only
- Help / DAW overlays do not scroll the synth behind them
- Gold nameplates: click Ring, Delay, LFO Depth, matrix Amt, etc. to bypass and restore the last amount
- Unison Off / 2 / 3 on the Mixer
- Quick start and training docs

## Mk III.1 (v3.1)

- 16-step arp pattern (gate, accent, ±octave) with playhead
- Arpeggiator Hold / Latch (Pattern also arms the arp)
- Aftertouch in the modulation matrix (channel + poly)
- Matrix **Vel** and **FEG** actually modulate (not display-only)
- Live pitch-bend on sounding notes
- Mute stays muted when you turn knobs
- Sustain + arp no longer latches forever
- LFO 1 / LFO 2 use aligned Rate / Depth sliders
- Five extra Lead patches (Howl Super, Air Super, Super Chorus, Wide Chorus, Halo Lead)
- 271 factory patches in banks (incl. Techno, Strings, Drums)

## Mk III (v3)

- DAW mode: IAC port picker, MIDI clock follow, Ableton / Logic setup
- Favorites and user-named patches
- Yamaha-style legato
- Faceplate polish for 15-inch screens (header, matrix, knobs)

## Mk II

- Dual LFO (cutoff, pitch, pan, amp, resonance, FM)
- 4-slot modulation matrix (LFO1/2, filter EG, velocity, mod wheel)
- Ring mod, analog-style sync, oscillator drift
- Wavetable (Table) oscillator + notch filter + velocity to cutoff
- FX rack: chorus, delay, reverb, phaser
- 32-voice polyphony
- Hide the on-screen keyboard for hardware MIDI (M-Audio etc.)
- Four-column panel layout

## Run

```bash
npm install
npm run dev
```

Open the app, press a piano key or A–L. The first keystroke unlocks audio (browser policy).

USB MIDI: plug in a class-compliant keyboard, allow MIDI when prompted. Safari does not support Web MIDI. Use the keyboard icon in the header to hide the on-screen piano.

In the app: header **?** button, or press <kbd>?</kbd>.

## Docs

- [Quick start](docs/QUICK-START.md) — first 2 minutes
- [Training manual](docs/TRAINING.md) — full walkthrough of every plate

## Stack

TanStack Start / Vite / React 19, Web Audio API, Web MIDI API, Zustand.

## License

Private / all rights reserved unless otherwise noted.
