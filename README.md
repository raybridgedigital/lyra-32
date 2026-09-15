# LYRA-32 Mk IV.6

Hybrid polyphonic web synthesizer by [Raybridge Digital](https://github.com/raybridgedigital).

Play from a class-compliant USB-C MIDI keyboard, the computer keys (A–L), or the on-screen piano. Chrome / Edge / Firefox.

This tag is the restore point **with** the wavetable plate, 12 real tables, and Serum-style warp.

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
