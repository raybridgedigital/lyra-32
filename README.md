# LYRA-32

Hybrid polyphonic web synthesizer by [Raybridge Digital](https://github.com/raybridgedigital).

Play from a class-compliant USB-C MIDI keyboard, the computer keys (A–L), or the on-screen piano. Chrome / Edge / Firefox.

## What’s in this version

- Dual oscillator VA (sine / tri / saw / square / pulse / stack) + sub + noise + FM
- LP / HP / BP filter, 12 / 24 dB, dual ADSR, LFO, unison, glide
- Chorus, delay, reverb
- Arpeggiator
- 32-voice polyphony
- 114 factory patches in banks (Bass, Lead, Keys, Brass, Pad, Pluck, Bell, Sequence, FX)
- Web MIDI + computer keyboard + on-screen keys
- User patches in `localStorage`

## Run

```bash
npm install
npm run dev
```

Open the app, press a piano key or A–L. The first keystroke unlocks audio (browser policy).

USB MIDI: plug in a class-compliant keyboard, allow MIDI when prompted. Safari does not support Web MIDI.

## Stack

TanStack Start / Vite / React 19, Web Audio API, Web MIDI API, Zustand.

## License

Private / all rights reserved unless otherwise noted.
