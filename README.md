# LYRA-32 Mk III

Hybrid polyphonic web synthesizer by [Raybridge Digital](https://github.com/raybridgedigital).

Play from a class-compliant USB-C MIDI keyboard, the computer keys (A–L), or the on-screen piano. Chrome / Edge / Firefox.

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
- 166 factory patches in banks (incl. Techno, Strings, Drums)

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

## Stack

TanStack Start / Vite / React 19, Web Audio API, Web MIDI API, Zustand.

## License

Private / all rights reserved unless otherwise noted.
