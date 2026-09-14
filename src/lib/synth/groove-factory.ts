import {
  cloneClip,
  defaultGroove,
  parseLane,
  parsePhraseClips,
  withBars,
  type Bars,
  type DrumKitId,
  type Groove,
  type DrumPart,
} from "./groove";

export type PhrasePreset = { id: string; name: string; group: string; code: string; length?: 8 | 16 | 32; bars?: Bars };
export type BeatPreset = {
  id: string;
  name: string;
  group: string;
  kit?: DrumKitId;
  lanes: Partial<Record<DrumPart, string>>;
  length?: 8 | 16 | 32;
  bars?: Bars;
};
export type GroovePreset = { id: string; name: string; group: string; phrase: string; beat: string };

function barsOf(p: { bars?: Bars; length?: number }, fallback: Bars): Bars {
  if (p.bars) return p.bars;
  if (p.length === 32) return 2;
  return fallback;
}

export const PHRASES: PhrasePreset[] = [
  { id: "p-empty", name: "Empty 16", group: "Blank", code: ". . . . . . . . . . . . . . . ." },
  { id: "p-empty8", name: "Empty 8", group: "Blank", code: ". . . . . . . .", length: 8 },
  { id: "p-root", name: "Root Pulse", group: "Bass", code: "C2 . C2 . C2 . C2 . C2 . C2 . C2 . C2 ." },
  { id: "p-offbeat", name: "Offbeat Techno", group: "Bass", code: ". C2 . C2 . C2 . C2 . C2 . C2 . C2 . C2" },
  { id: "p-fourfive", name: "One-Five House", group: "Bass", code: "C2 . . . G1 . . . C2 . . . G1 . . ." },
  { id: "p-303", name: "303 Slide", group: "Bass", code: "C2 C2/ D#2 C2~ . F2 G1/ C2 . C2 D#2/ F2 . G1 C2 . C2" },
  { id: "p-dnb", name: "DnB Run", group: "Bass", code: "C2 . C2 G1 C2 . D#2 C2 C2 . C2 G1 C2* . F2 C2" },
  { id: "p-dub", name: "Dub Whole", group: "Bass", code: "C2~ . . . . . . . G1~ . . . . . . ." },
  { id: "p-fifths", name: "Fifths", group: "Lead", code: "C3 . G3 . C3 . G3 . D3 . A3 . D3 . A3 ." },
  { id: "p-call", name: "Call Response", group: "Lead", code: "C4 . D#4 F4 . G4 . . C4 . A#3 G3 . F3 . ." },
  { id: "p-trance", name: "Trance Hook", group: "Lead", code: "C4 C4 D#4 F4 G4 . F4 . D#4 . C4 . G3 . . ." },
  { id: "p-acid16", name: "Acid 16ths", group: "Lead", code: "C3 D#3 C3 F3 C3 G3 C3 D#3 C3 F3 C3 G3 A#2 C3 D#3 C3" },
  { id: "p-osti", name: "Ostinato 8ths", group: "Arp-like", code: "C3 . D#3 . F3 . G3 . C3 . D#3 . F3 . A#3 ." },
  { id: "p-pent", name: "Pent Climb", group: "Arp-like", code: "C3 D#3 F3 G3 A#3 C4 D#4 F4 G4 F4 D#4 C4 A#3 G3 F3 D#3" },
  { id: "p-stabs", name: "Four Stabs", group: "Stab", code: "C3* . . . C3* . . . C3* . . . C3* . . ." },
  { id: "p-triad", name: "Triad Stabs", group: "Stab", code: "C3+E3+G3* . . . C3+E3+G3* . . . C3+E3+G3* . . . C3+E3+G3* . . ." },
  { id: "p-ska", name: "Offbeat Stabs", group: "Stab", code: ". C3 . C3 . C3 . C3 . C3 . C3 . C3 . C3" },
  { id: "p-held", name: "Held Pad", group: "Stab", code: "C3~ . . . . . . . C3~ . . . . . . ." },
  { id: "p-fill", name: "Last-bar Lift", group: "Fill", code: ". . . . . . . . C3 D#3 F3 G3 A#3 C4 D#4 F4" },
  { id: "p-toms", name: "Tom Run", group: "Fill", code: "C2 C2 G1 G1 F1 F1 C1 C1 C2 . G1 . F1 . C1 ." },
  { id: "p-walk", name: "Minor Walk", group: "Bass", code: "C2 . D#2 . F2 . G2 . G#1 . A#1 . C2 . D#2 ." },
  { id: "p-syncop", name: "Syncop Bass", group: "Bass", code: "C2 . . C2 . . C2 . . C2 C2 . G1 . . C2" },
  { id: "p-ukg", name: "UKG Skip", group: "Bass", code: "C2 . . G1 . C2 . . C2 . G1 . C2 . D#2 ." },
  { id: "p-octaves", name: "Octave Jump", group: "Lead", code: "C3 C4 C3 C4 D#3 D#4 F3 F4 G3 G4 F3 F4 D#3 D#4 C3 C4" },
];

export const BEATS: BeatPreset[] = [
  {
    id: "b-four",
    name: "Four on Floor",
    group: "Floor",
    lanes: { kick: "X...X...X...X...", snare: "....X.......X...", ch: "x.x.x.x.x.x.x.x." },
  },
  {
    id: "b-clap",
    name: "Floor + Clap",
    group: "Floor",
    lanes: { kick: "X...X...X...X...", clap: "....X.......X...", ch: "x.x.x.x.x.x.x.x." },
  },
  {
    id: "b-open",
    name: "Open Hat 16",
    group: "Floor",
    kit: "tight",
    lanes: { kick: "X...X...X...X...", snare: "....X.......X...", ch: "xxxxxxxxxxxxxxxx", oh: "..x...x...x...x." },
  },
  {
    id: "b-disco",
    name: "Disco Hats",
    group: "Floor",
    kit: "tight",
    lanes: { kick: "X...X...X...X...", clap: "....X.......X...", ch: "x.x.x.x.x.x.x.x.", oh: "..x...x...x...x.", htom: "............x...", ltom: "..............x." },
  },
  {
    id: "b-offkick",
    name: "Offkick",
    group: "Floor",
    lanes: { kick: "X..X.X..X..X.X..", snare: "....X.......X...", ch: "x.x.x.x.x.x.x.x." },
  },
  {
    id: "b-break",
    name: "Break Lane",
    group: "Break",
    kit: "dust",
    lanes: { kick: "X.......X.X.....", snare: "....X..x....X...", ch: "x.x.x.x.x.x.x.x.", perc: "..x......x......", htom: "........x.x.....", ltom: "..........x.x..." },
  },
  {
    id: "b-half",
    name: "Half Time",
    group: "Break",
    lanes: { kick: "X...............", snare: "........X.......", ch: "x...x...x...x...", oh: "....x.......x...", ltom: "......x.........", htom: "..........x.x..." },
  },
  {
    id: "b-twostep",
    name: "Two Step",
    group: "Break",
    kit: "tight",
    lanes: { kick: "X.........X.....", snare: "....X.......X...", ch: "x.x.x.x.x.x.x.x." },
  },
  {
    id: "b-boom",
    name: "Boom Bap",
    group: "Hip-hop",
    kit: "dust",
    lanes: { kick: "X.........X.....", snare: "....X.......X...", ch: "x.x.x.x.x.x.x.x.", perc: "......x.........", ltom: "..........x....." },
  },
  {
    id: "b-trap",
    name: "Trap Hats",
    group: "Hip-hop",
    kit: "tight",
    lanes: { kick: "X......X.X......", snare: "....X.......X...", ch: "xxxxxxxxxxxxxxxx" },
  },
  {
    id: "b-808",
    name: "808 Cowbell",
    group: "Electro",
    kit: "analog",
    lanes: { kick: "X...X...X...X...", clap: "....X.......X...", perc: "..x...x...x...x.", ch: "x.x.x.x.x.x.x.x." },
  },
  {
    id: "b-indus",
    name: "Industrial",
    group: "Electro",
    kit: "industrial",
    lanes: { kick: "X.X.X...X.X.X...", snare: "....X..X....X...", perc: "x...x.x.x...x.x.", ltom: "..X.......X.....", htom: "....x.x.....x.x." },
  },
  {
    id: "b-electro",
    name: "Electro Clap",
    group: "Electro",
    lanes: { kick: "X...X.X.X...X.X.", clap: "....X.......X...", ch: "..x...x...x...x.", htom: "......x.......x." },
  },
  {
    id: "b-perc",
    name: "Perc Groove",
    group: "Perc",
    lanes: { kick: "X...X...X...X...", perc: "..x.x...x.x.x...", ch: "x.x.x.x.x.x.x.x.", htom: "..x...x...x...x.", ltom: "....x.......x..." },
  },
  {
    id: "b-rim",
    name: "Rim Skip",
    group: "Perc",
    kit: "tight",
    lanes: { kick: "X.......X..X....", snare: "....X.......X...", perc: "..x...x...x...x.", ch: "x.x.x.x.x.x.x.x.", htom: "......x.......x." },
  },
  {
    id: "b-toms",
    name: "Tom Fill",
    group: "Perc",
    lanes: {
      kick: "X...X...X...X...",
      snare: "....X.......X...",
      ch: "x.x.x.x.x.x.x.x.",
      htom: "........x.x.....",
      ltom: "..........x.x.x.",
    },
  },
  {
    id: "b-tribal",
    name: "Tom Groove",
    group: "Perc",
    kit: "dust",
    lanes: {
      kick: "X.......X.......",
      ltom: "x...x...x...x...",
      htom: "..x.x.x...x.x.x.",
      ch: "x.x.x.x.x.x.x.x.",
    },
  },
  {
    id: "b-kick",
    name: "Kick Only",
    group: "Sparse",
    lanes: { kick: "X...X...X...X..." },
  },
  {
    id: "b-ks",
    name: "Kick Snare",
    group: "Sparse",
    lanes: { kick: "X...X...X...X...", snare: "....X.......X..." },
  },
  {
    id: "b-hats",
    name: "Hats Only",
    group: "Sparse",
    kit: "tight",
    lanes: { ch: "x.x.x.x.x.x.x.x.", oh: "..x...x...x...x." },
  },
  {
    id: "b-shuffle",
    name: "Shuffle",
    group: "Floor",
    kit: "tight",
    lanes: { kick: "X...X...X...X...", snare: "....X.......X...", ch: "x..xx..xx..xx..x", oh: "...x...x...x...x" },
  },
  {
    id: "b-deep",
    name: "Deep House",
    group: "Floor",
    lanes: { kick: "X.......X...X...", clap: "....X.......X...", ch: "x.x.x.x.x.x.x.x.", oh: "......x.......x." },
  },
  {
    id: "b-techhat",
    name: "Techno Drive",
    group: "Floor",
    kit: "tight",
    lanes: { kick: "X...X...X...X...", snare: "....X.......X...", ch: "xxxxxxxxxxxxxxxx", perc: "..x...x...x...x." },
  },
  {
    id: "b-skip",
    name: "Skip House",
    group: "Floor",
    lanes: { kick: "X..X.X..X...X...", clap: "....X.......X...", ch: "x.x.x.x.x.x.x.x.", oh: "..x...x...x...x." },
  },
  {
    id: "b-garage",
    name: "UK Garage",
    group: "Break",
    kit: "tight",
    lanes: { kick: "X.....X.X.......", snare: "....X..x....X...", ch: "x.x.x.x.x.x.x.x.", oh: "......x.......x." },
  },
  {
    id: "b-amen",
    name: "Amen Chop",
    group: "Break",
    kit: "dust",
    lanes: {
      kick: "X.x.....XX......",
      snare: "....X..x.x..X...",
      ch: "x.x.x.x.x.x.x.x.",
      perc: "..x...........x.",
      htom: "........x.......",
      ltom: "..........x.x...",
    },
  },
  {
    id: "b-dnbhats",
    name: "DnB Hats",
    group: "Break",
    kit: "tight",
    lanes: { kick: "X.....X.X.......", snare: "....X.......X...", ch: "xxxxxxxxxxxxxxxx", oh: "......x.......x." },
  },
  {
    id: "b-jungle",
    name: "Jungle Fill",
    group: "Break",
    kit: "dust",
    lanes: {
      kick: "X.......X.X.....",
      snare: "....X..x....X.x.",
      ch: "x.x.x.x.x.x.x.x.",
      htom: "........x.x.....",
      ltom: "..........x.x.x.",
    },
  },
  {
    id: "b-drill",
    name: "Drill",
    group: "Hip-hop",
    kit: "tight",
    lanes: { kick: "X.....X..X.X....", snare: "....X.......X...", ch: "x.xx.x.xx.xx.x.x", perc: "........x......." },
  },
  {
    id: "b-jersey",
    name: "Jersey",
    group: "Hip-hop",
    lanes: { kick: "X.X.....X.X.....", snare: "....X.X.....X.X.", clap: "....X.......X...", ch: "x.x.x.x.x.x.x.x.", htom: "......x.......x." },
  },
  {
    id: "b-gfunk",
    name: "G-Funk",
    group: "Hip-hop",
    kit: "dust",
    lanes: { kick: "X.......X.X.....", snare: "....X.......X...", ch: "x...x...x...x...", oh: "....x.......x...", perc: "........x......." },
  },
  {
    id: "b-httrap",
    name: "Half Trap",
    group: "Hip-hop",
    kit: "tight",
    lanes: { kick: "X...........X...", snare: "........X.......", ch: "xxxxxxxxxxxxxxxx", perc: "....x..........." },
  },
  {
    id: "b-footwork",
    name: "Footwork",
    group: "Hip-hop",
    kit: "tight",
    lanes: { kick: "X.X.X.X.X.X.X.X.", snare: "..X...X...X...X.", ch: "xxxxxxxxxxxxxxxx" },
  },
  {
    id: "b-dembow",
    name: "Dembow",
    group: "Latin",
    lanes: { kick: "X..X....X..X....", snare: "....X.......X...", ch: "x.x.x.x.x.x.x.x.", perc: "......x.......x." },
  },
  {
    id: "b-afro",
    name: "Afrobeat",
    group: "Latin",
    kit: "dust",
    lanes: { kick: "X...X.X.X...X.X.", snare: "....X.......X...", perc: "x.x..x.x.x.x..x.", ch: "..x...x...x...x.", htom: "......x.......x." },
  },
  {
    id: "b-samba",
    name: "Samba",
    group: "Latin",
    lanes: { kick: "X...X...X...X...", perc: "x.x.x.xx.x.x.xx.", htom: "..x...x...x...x.", ltom: "....x.......x...", ch: "x.x.x.x.x.x.x.x." },
  },
  {
    id: "b-clave",
    name: "Clave",
    group: "Latin",
    lanes: { kick: "X...X.X.....X...", clap: "....X.......X...", perc: "x..x.x..x..x.x..", ch: "..x...x...x...x." },
  },
  {
    id: "b-bossa",
    name: "Bossa",
    group: "Latin",
    kit: "dust",
    lanes: { kick: "X...X...X...X...", snare: "....X..x....X...", ch: "x.x.x.x.x.x.x.x.", perc: "..x...x...x.x...", oh: "......x........." },
  },
  {
    id: "b-motorik",
    name: "Motorik",
    group: "Rock",
    lanes: { kick: "X...X...X...X...", snare: "....X.......X...", ch: "x.x.x.x.x.x.x.x.", perc: "........x.......", oh: "......x.......x." },
  },
  {
    id: "b-punk",
    name: "Punk Four",
    group: "Rock",
    kit: "industrial",
    lanes: { kick: "X.X.X.X.X.X.X.X.", snare: "....X.......X...", ch: "xxxxxxxxxxxxxxxx", oh: "....x.......x..." },
  },
];

export const GROOVES: GroovePreset[] = [
  { id: "g-techno", name: "Techno Floor", group: "Live", phrase: "p-offbeat", beat: "b-four" },
  { id: "g-house", name: "House 1-5", group: "Live", phrase: "p-fourfive", beat: "b-clap" },
  { id: "g-disco", name: "Disco", group: "Live", phrase: "p-ska", beat: "b-disco" },
  { id: "g-303", name: "Acid", group: "Live", phrase: "p-303", beat: "b-four" },
  { id: "g-dnb", name: "DnB", group: "Live", phrase: "p-dnb", beat: "b-break" },
  { id: "g-dub", name: "Dub", group: "Live", phrase: "p-dub", beat: "b-half" },
  { id: "g-ukg", name: "UKG", group: "Live", phrase: "p-ukg", beat: "b-twostep" },
  { id: "g-trap", name: "Trap", group: "Live", phrase: "p-root", beat: "b-trap" },
  { id: "g-boom", name: "Boom Bap", group: "Live", phrase: "p-walk", beat: "b-boom" },
  { id: "g-indus", name: "Industrial", group: "Live", phrase: "p-syncop", beat: "b-indus" },
  { id: "g-trance", name: "Trance", group: "Live", phrase: "p-trance", beat: "b-open" },
  { id: "g-pad", name: "Pad Pulse", group: "Live", phrase: "p-held", beat: "b-kick" },
  { id: "g-toms", name: "Tom Run", group: "Live", phrase: "p-toms", beat: "b-toms" },
];

export function phraseFromPreset(p: PhrasePreset): Groove["tracks"][number] {
  return parsePhraseClips(p.code);
}

export function applyPhrase(g: Groove, id: string): Groove {
  const p = PHRASES.find((x) => x.id === id);
  if (!p) return g;
  const phrase = parsePhraseClips(p.code);
  const bars = barsOf(p, g.bars);
  const arm = g.arm.some(Boolean) ? g.arm : [true, false, false, false];
  const tracks = g.tracks.map((tr, i) => (arm[i] ? phrase.map(cloneClip) : tr));
  return withBars({ ...g, tracks, arm, seqOn: true }, bars);
}

export function applyBeat(g: Groove, id: string): Groove {
  const b = BEATS.find((x) => x.id === id);
  if (!b) return g;
  const drums = { ...g.drums };
  (Object.keys(drums) as DrumPart[]).forEach((k) => {
    drums[k] = parseLane(b.lanes[k] ?? "................................");
  });
  return withBars({ ...g, drums, drumsOn: true, kit: b.kit ?? g.kit }, barsOf(b, g.bars));
}

export function applyGroovePreset(id: string, base?: Groove): Groove {
  const g = GROOVES.find((x) => x.id === id);
  if (!g) return base ?? defaultGroove();
  let next = applyBeat(base ?? defaultGroove(), g.beat);
  const p = PHRASES.find((x) => x.id === g.phrase);
  const phrase = p ? parsePhraseClips(p.code) : next.tracks[0]!;
  next = {
    ...next,
    tracks: next.tracks.map((tr, i) => (i === 0 ? phrase.map(cloneClip) : tr)),
    arm: [true, false, false, false],
    seqOn: true,
    drumsOn: true,
  };
  return next;
}
