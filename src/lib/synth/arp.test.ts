import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cycleArpStep, defaultArpSteps, normalizeArpSteps, stepKind, stepsFromCode, type ArpStep } from "./arp.ts";

describe("arp steps", () => {
  it("defaults to an audible offbeat gate", () => {
    const s = defaultArpSteps();
    assert.equal(s.length, 16);
    assert.deepEqual(
      s.map((x) => x.on),
      [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false],
    );
  });

  it("cycles rest → gate → accent → up → down → rest", () => {
    let s: ArpStep = { on: false, accent: false, oct: 0 };
    const kinds = [];
    for (let i = 0; i < 5; i++) {
      s = cycleArpStep(s);
      kinds.push(stepKind(s));
    }
    assert.deepEqual(kinds, ["gate", "accent", "up", "down", "rest"]);
  });

  it("parses compact pattern codes", () => {
    const s = stepsFromCode("x.Xu.d");
    assert.equal(stepKind(s[0]!), "gate");
    assert.equal(stepKind(s[1]!), "rest");
    assert.equal(stepKind(s[2]!), "accent");
    assert.equal(stepKind(s[3]!), "up");
    assert.equal(stepKind(s[4]!), "rest");
    assert.equal(stepKind(s[5]!), "down");
    assert.equal(s.length, 16);
  });

  it("normalizes missing or short arrays", () => {
    const s = normalizeArpSteps([{ on: true, accent: true, oct: 1 }]);
    assert.equal(s.length, 16);
    assert.equal(s[0]!.accent, true);
    assert.equal(s[0]!.oct, 1);
    assert.equal(s[1]!.on, false);
  });
});
