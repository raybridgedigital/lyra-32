# LYRA-32 Mk V — training manual

Hybrid 32-voice web synthesizer by Ray Bridge Digital. Play it in Chrome, Edge, or Firefox. This is the full course — the in-app Help (**?**) is the same material in short form.

---

## 1. What it is

LYRA-32 is a flagship-style subtractive / hybrid instrument in the browser:

- Two oscillators (analog waves, pulse, supersaw, wavetable)
- Sub sine + white noise
- Multimode filter (LP / HP / BP / Notch, 12 or 24 dB)
- Amp EG + Filter EG
- Two LFOs + 6-slot modulation matrix
- Ring, sync, FM, unison, drift, drive
- Arpeggiator with Hold/Latch and a 16-step pattern
- FX: delay, reverb, chorus, phaser
- 271 factory patches, favorites, user saves
- USB MIDI, computer keyboard, on-screen piano
- DAW mode (Ableton / Logic via IAC MIDI clock)

It is **not** a VST/AU plugin. To sequence it from a DAW, send MIDI over IAC (see §9).

---

## 2. First session (5 minutes)

1. Open the app.
2. Click a piano key or press **A**. Audio unlocks on that gesture and stays live. Header **Live** turns gold.
3. Step through patches with the header arrows, or open **Library** under the faceplate.
4. Play a chord. Watch the voice counter (Activity icon) — polyphony is 32.
5. Plug a class-compliant USB-C keyboard (M-Audio, etc.). Allow MIDI. The MIDI badge shows the port name.
6. Click the keyboard icon to hide the on-screen piano.
7. Open **?** (or press **?**) whenever you want this material on screen.

**Panic** (or **Esc**) = all notes off, arp latch cleared, aftertouch/mod zeroed. Use it for stuck notes, not volume.

**Mute** silences the master. It stays muted when you turn knobs. Gold = muted.

---

## 3. Playing

### On-screen piano

Three octaves. Root is the header octave (default **C3**). Pointer down = note on, up = note off.

### Computer keyboard

Two-row piano. **A** is C of the current octave.

```
Blacks:   W   E     T   Y   U     O   P
Whites: A   S   D  F   G   H   J  K   L  ;  '
```

| Key | Action |
|---|---|
| Z / X | Octave down / up |
| Esc | Close Help or DAW if open, otherwise Panic |
| ? | Toggle Help |

Sliders (LFO, matrix amount) do not steal the piano. Search / rename / save fields do — click the faceplate to play again.

### USB MIDI

Works in Chrome / Edge / Firefox. Not Safari.

| Message | LYRA |
|---|---|
| Notes | 32-voice poly, or mono / legato |
| Pitch bend | ±2 semitones, **live on sounding notes** |
| CC1 mod wheel | Cutoff + matrix source **Mod** |
| CC74 | Cutoff (brightness) |
| CC7 | Master volume |
| CC64 | Sustain pedal |
| Channel / poly aftertouch | Matrix source **AT** |

### Voice modes (Mixer plate)

- **Poly** — chords, 32 voices, oldest stolen when full.
- **Mono** — one note; each new key retriggers envelopes.
- **Leg** — Yamaha fingered legato. Overlapping keys do **not** retrigger. Last-note priority. **Glide** sets portamento time (instant if Glide is 0).

---

## 4. Sound design — the faceplate

Knobs: click-drag **vertically**. Mouse up = clockwise.

### Oscillator 1 / 2

Waves: Sine, Tri, Saw, Square, Pulse, Super, Table.

- **Pulse** — PWM knob is pulse width.
- **Super** — seven detuned saws (classic stack). Unison still applies on the other waves.
- **Table** — wavetable morph; PWM is the morph position (vowel → metal).

**Oct** ±2, **Semi** ±12, **Fine** ±100 cents, **Level**. A few cents of Osc 2 Fine is the beating-chorus trick.

### Mixer

| Control | Role |
|---|---|
| Sub | Sine, one octave under Osc 1 |
| Noise | White noise into the filter |
| Uni / Det / Spr | Off plus 2–7 unison copies, detune, stereo spread |
| Drive | Tanh saturation before the filter |
| Ring | Osc 2 × Osc 1 (bells, clang) |
| Sync | Osc 2 hard-syncs Osc 1 (screams, leads) |
| FM | Osc 2 → Osc 1 pitch |
| Drift | Slow analog-style pitch wander |
| Glide | Portamento, heard in Mono / Legato |
| Vel (filter plate) | Velocity opens cutoff |

### Filter

LP / HP / BP / Notch. 12 or 24 dB/oct. **Cut**, **Res**, **Env** (filter EG depth), **Tone** (tilt after the filter), **Key** (higher notes brighter).

Cutoff on a held note follows the knob. Filter **type** is sampled at note-on. Tone does not move cutoff — left is darker, right is brighter.

Amp EG **Vel** is velocity to loudness. Filter **Vel** is velocity to cutoff.

### Amp EG / Filter EG

ADSR. Values under 1 s show as milliseconds.

Amp EG = loudness. Filter EG = how the cutoff moves over the note. A pluck: short Amp decay, low sustain, Filter Env up with a fast decay.

### LFO 1 / LFO 2

Rate, Depth, and Fade are **sliders** (not knobs). Destinations: Cut, Pitch, Pan, Amp, Res, FM. Waves: sine, tri, saw, square, S&H.

Rate/wave change live on sounding notes. Destination is captured at note-on. Fade ramps LFO depth in from silence.

### Matrix (6 slots)

Extra modulation, stacked on the LFO plates.

**Sources:** LFO1, LFO2, FEG (filter envelope), Vel (velocity 0–1), Mod (mod wheel), AT (aftertouch), Key, Rnd.

**Destinations:** Cut, Pitch, Pan, Amp, Res, FM, PWM, Mix, Drv, FX, Gld.

**Amt** is bipolar (−100 … +100). Near-zero amounts are ignored.

Example: AT → Cut with Amt +50 for a filter that opens when you press into the key. Vel → Amp for extra dynamics on top of the built-in velocity curve.

### FX

Delay mix / time / feedback, Reverb, Chorus, Phaser. All are wet mixes into the master limiter.

---

## 5. Arpeggiator and 16-step pattern

### Arp plate

- **On** — held notes are sequenced, not played as a chord.
- **Hold** — latches the chord after you lift your hands. Play a new chord (all keys up, then a new set down) to replace it. Panic clears it.
- **Up / Dn / U/D / Rnd / Ord** — order. Rnd shuffles once per cycle. Ord = as played.
- **BPM** — ignored when DAW Clock is running.
- **Gate** — note length as a fraction of the step.
- **Swing** — delays even 16ths.
- **Oct** — 1, 2, or 3 octaves.
- Rate: 1/4, 1/8, 1/8t, 1/16, 1/16t.

Sustain pedal without Hold keeps the arp going until you lift the pedal.

### Pattern bar (under the faceplate)

**Pattern** arms the arp and overlays 16 steps on the note order. Gold outline = playhead.

Click a step to cycle:

| Look | Meaning |
|---|---|
| Empty | Rest (skip, clock still advances) |
| Dim | Gate — play |
| Bright + • | Accent — harder velocity |
| +1 | One octave up |
| −1 | One octave down |

A rest pattern like `x.x.x.x.x.x.x.x.` at 1/16 is an eighth-note feel. Factory **Techno Seq** is a worked example (Pattern + Hold already on).

---

## 6. Library and user patches

Banks: Bass, Lead, Keys, Brass, Pad, Pluck, FX, Sequence, Drums, Strings, Techno, Favorite, User.

- **Star** a patch (header or library) → Favorite group.
- **Name this patch** + **Save** → User copy in this browser (`localStorage`). Factory patches are never overwritten.
- Pencil = rename a user patch. Trash = delete it (and unfavorite it).

Suggested listen:

- Keys — Init Dual Saw
- Lead — Scream Super, Howl Super, Chorus Lead, Halo Lead
- Bass — Sub Current
- Sequence — Techno Seq

---

## 7. Header map

Left: **LYRA-32** wordmark, oscilloscope.

Center: previous / patch menu / next / favorite star. The menu stays centered when MIDI names expand.

Right: Live, MIDI name, voice count, octave, keyboard visibility, Mute, DAW, Help, Panic.

---

## 8. MIDI controllers (M-Audio and friends)

1. USB-C in. Allow MIDI.
2. Hide the web keyboard.
3. Pitch wheel should move held notes. Mod wheel opens cutoff (and any matrix Mod route). Aftertouch needs an AT route in the matrix — Init Dual Saw already has AT → Cut.

If two devices fight, DAW panel → pick one port instead of All.

---

## 9. Ableton Live and Logic Pro

LYRA cannot load as a plugin. Use it as an **external instrument**.

### macOS IAC

1. Audio MIDI Setup → Window → Show MIDI Studio.
2. IAC Driver → Device is online. Keep Bus 1.

### Ableton Live

1. Settings → Link, Tempo & MIDI.
2. Output **IAC Driver Bus 1**: Track On, Sync On.
3. MIDI track: MIDI To = IAC Driver Bus 1.
4. Optional audio back: BlackHole as Chrome output, audio track input = BlackHole.

### Logic Pro

1. Logic Pro → Settings → MIDI → Sync to IAC Bus 1, clock on.
2. External Instrument plugin, MIDI Destination = IAC Bus 1.
3. Play the track — notes and clock hit LYRA.

In LYRA: **DAW** button → pick the IAC port → **Clock on**. Keep the tab visible. Transport stop returns the arp to the patch BPM.

---

## 10. Signal flow (for sound designers)

```
Osc1 + Osc2 + Sub + Noise
        → Drive (tanh)
        → Filter (12/24, EG, key, vel)
        → Tone (tilt EQ, cutoff stays put)
        → Amp EG → pan → aftertouch/mod amp
        → FX splits (chorus, delay, reverb, phaser)
        → Master → limiter → speakers
```

Unison/Super copies are panned by Spread. LFOs and matrix tap cutoff, pitch, pan, amp, resonance, FM, PWM, osc mix, drive, FX send, and glide.

Most oscillator/filter-type/matrix dest changes apply on the **next note**. Cutoff, FX mixes, LFO rate/wave, and master apply live.

---

## 11. Troubleshooting

| Symptom | Fix |
|---|---|
| Silence, Idle | Click a key once. Check the Chrome tab is not muted. |
| Silence, Live, Mute gold | Click Mute. |
| Stuck note | Panic / Esc. |
| No MIDI | Chrome/Edge/Firefox. Allow MIDI. Re-plug. |
| Pitch wheel dead on old build | v3.1 retunes live voices — reload. |
| Arp keeps going after lift | Hold is on, or sustain pedal is down. Panic to clear. |
| Computer keys dead | Focus is in Search / Rename. Click the faceplate. |
| Safari | No Web MIDI. Use Chrome. Audio still works from the web keys. |

---

## 12. Practice drills

1. **Init Dual Saw**, play a triad in Poly, then switch Leg and play overlapping notes — hear no envelope retrigger.
2. Raise **Sync** on a saw lead, sweep Osc 2 Fine — classic hard-sync scream.
3. Matrix: AT → Cut +50. Press into the key.
4. Load **Techno Seq**. Lift your hands (Hold). Click pattern steps. Hit Panic.
5. Mute, twist Cut, confirm silence, unmute.

That is the instrument. Design from Init Dual Saw; steal ideas from the 271 factory patches.
