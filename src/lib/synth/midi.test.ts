import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMidi, type MidiHandlers } from "./midi.ts";

function capture(): { h: MidiHandlers; at: number[]; ccs: number[][] } {
  const at: number[] = [];
  const ccs: number[][] = [];
  const h: MidiHandlers = {
    noteOn: () => undefined,
    noteOff: () => undefined,
    cc: (ctl, value) => {
      ccs.push([ctl, value]);
    },
    pitchBend: () => undefined,
    aftertouch: (v) => {
      at.push(v);
    },
    onStatus: () => undefined,
  };
  return { h, at, ccs };
}

describe("parseMidi aftertouch", () => {
  it("maps channel aftertouch to 0–1 and not to CC 74", () => {
    const { h, at, ccs } = capture();
    parseMidi(Uint8Array.of(0xd0, 64), h);
    assert.equal(at.length, 1);
    assert.ok(Math.abs(at[0]! - 64 / 127) < 1e-9);
    assert.equal(ccs.length, 0);
  });

  it("treats poly aftertouch as channel pressure", () => {
    const { h, at } = capture();
    parseMidi(Uint8Array.of(0xa0, 60, 100), h);
    assert.equal(at.length, 1);
    assert.ok(Math.abs(at[0]! - 100 / 127) < 1e-9);
  });
});

describe("parseMidi clock", () => {
  it("emits stop on 0xFC", () => {
    const ticks: { bpm: number | null; running: boolean }[] = [];
    const { h } = capture();
    h.onClock = (info) => ticks.push(info);
    parseMidi(Uint8Array.of(0xfa), h);
    parseMidi(Uint8Array.of(0xfc), h);
    assert.equal(ticks.at(-1)?.running, false);
  });
});
