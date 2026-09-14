import type { DrumKitId, DrumPart } from "./groove";

type Kit = {
  kickPitch: number;
  kickDecay: number;
  snareTone: number;
  snareDecay: number;
  hatHp: number;
  hatDecay: number;
  ohDecay: number;
  clapDecay: number;
  percHz: number;
  ltomPitch: number;
  ltomDecay: number;
  htomPitch: number;
  htomDecay: number;
  color: number;
};

const KITS: Record<DrumKitId, Kit> = {
  analog: { kickPitch: 150, kickDecay: 0.28, snareTone: 190, snareDecay: 0.18, hatHp: 7000, hatDecay: 0.045, ohDecay: 0.28, clapDecay: 0.22, percHz: 720, ltomPitch: 175, ltomDecay: 0.32, htomPitch: 310, htomDecay: 0.22, color: 1 },
  tight: { kickPitch: 130, kickDecay: 0.16, snareTone: 220, snareDecay: 0.11, hatHp: 9000, hatDecay: 0.028, ohDecay: 0.16, clapDecay: 0.14, percHz: 880, ltomPitch: 195, ltomDecay: 0.18, htomPitch: 350, htomDecay: 0.13, color: 0.7 },
  dust: { kickPitch: 110, kickDecay: 0.38, snareTone: 165, snareDecay: 0.26, hatHp: 5200, hatDecay: 0.07, ohDecay: 0.4, clapDecay: 0.3, percHz: 540, ltomPitch: 150, ltomDecay: 0.42, htomPitch: 270, htomDecay: 0.3, color: 1.35 },
  industrial: { kickPitch: 90, kickDecay: 0.22, snareTone: 140, snareDecay: 0.2, hatHp: 4200, hatDecay: 0.05, ohDecay: 0.22, clapDecay: 0.18, percHz: 210, ltomPitch: 125, ltomDecay: 0.24, htomPitch: 230, htomDecay: 0.16, color: 1.8 },
};

function noise(ctx: AudioContext, seconds: number) {
  const n = Math.max(32, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function env(g: GainNode, now: number, vel: number, attack: number, decay: number) {
  g.gain.cancelScheduledValues(now);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, vel), now + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);
}

export class DrumVoice {
  private ohGain: GainNode | null = null;
  constructor(
    private ctx: AudioContext,
    private dest: AudioNode,
  ) {}

  hit(part: DrumPart, vel: number, kitId: DrumKitId, now = this.ctx.currentTime) {
    const kit = KITS[kitId] ?? KITS.analog;
    const v = Math.max(0.05, Math.min(1, vel));
    if (part === "kick") this.kick(kit, v, now);
    else if (part === "snare") this.snare(kit, v, now);
    else if (part === "ch") this.hat(kit, v, now, false);
    else if (part === "oh") this.hat(kit, v, now, true);
    else if (part === "clap") this.clap(kit, v, now);
    else if (part === "ltom") this.tom(kit, v, now, false);
    else if (part === "htom") this.tom(kit, v, now, true);
    else this.perc(kit, v, now);
  }

  chokeOh(now = this.ctx.currentTime) {
    if (!this.ohGain) return;
    this.ohGain.gain.cancelScheduledValues(now);
    this.ohGain.gain.setTargetAtTime(0.0001, now, 0.008);
  }

  private kick(kit: Kit, vel: number, now: number) {
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(kit.kickPitch, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + kit.kickDecay * 0.85);
    const g = this.ctx.createGain();
    env(g, now, vel * 1.1, 0.004, kit.kickDecay);
    const click = this.ctx.createBufferSource();
    click.buffer = noise(this.ctx, 0.04);
    const cg = this.ctx.createGain();
    env(cg, now, vel * 0.22 * kit.color, 0.001, 0.02);
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 800;
    osc.connect(g);
    g.connect(this.dest);
    click.connect(hp);
    hp.connect(cg);
    cg.connect(this.dest);
    osc.start(now);
    osc.stop(now + kit.kickDecay + 0.05);
    click.start(now);
    click.stop(now + 0.04);
  }

  private snare(kit: Kit, vel: number, now: number) {
    const osc = this.ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = kit.snareTone;
    const og = this.ctx.createGain();
    env(og, now, vel * 0.35, 0.002, kit.snareDecay * 0.5);
    const src = this.ctx.createBufferSource();
    src.buffer = noise(this.ctx, 0.35);
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1800 * kit.color;
    bp.Q.value = 0.9;
    const ng = this.ctx.createGain();
    env(ng, now, vel * 0.7, 0.002, kit.snareDecay);
    osc.connect(og);
    og.connect(this.dest);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(this.dest);
    osc.start(now);
    osc.stop(now + kit.snareDecay + 0.04);
    src.start(now);
    src.stop(now + 0.35);
  }

  private hat(kit: Kit, vel: number, now: number, open: boolean) {
    if (!open) this.chokeOh(now);
    const src = this.ctx.createBufferSource();
    src.buffer = noise(this.ctx, 0.5);
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = kit.hatHp;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 9000;
    bp.Q.value = 0.6;
    const g = this.ctx.createGain();
    env(g, now, vel * (open ? 0.45 : 0.38), 0.001, open ? kit.ohDecay : kit.hatDecay);
    if (open) this.ohGain = g;
    src.connect(hp);
    hp.connect(bp);
    bp.connect(g);
    g.connect(this.dest);
    src.start(now);
    src.stop(now + (open ? kit.ohDecay : kit.hatDecay) + 0.05);
  }

  private clap(kit: Kit, vel: number, now: number) {
    const delays = [0, 0.012, 0.024, 0.041];
    for (const d of delays) {
      const src = this.ctx.createBufferSource();
      src.buffer = noise(this.ctx, 0.2);
      const bp = this.ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1100;
      bp.Q.value = 0.8;
      const g = this.ctx.createGain();
      env(g, now + d, vel * 0.45, 0.001, kit.clapDecay * 0.35);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.dest);
      src.start(now + d);
      src.stop(now + d + 0.2);
    }
  }

  private tom(kit: Kit, vel: number, now: number, high: boolean) {
    const start = high ? kit.htomPitch : kit.ltomPitch;
    const decay = high ? kit.htomDecay : kit.ltomDecay;
    const end = Math.max(48, start * (high ? 0.42 : 0.36));
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(start, now);
    osc.frequency.exponentialRampToValueAtTime(end, now + decay * 0.78);
    const g = this.ctx.createGain();
    env(g, now, vel * (high ? 0.78 : 0.9), 0.003, decay);
    const click = this.ctx.createBufferSource();
    click.buffer = noise(this.ctx, 0.05);
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = high ? 900 : 500;
    const cg = this.ctx.createGain();
    env(cg, now, vel * 0.16 * kit.color, 0.001, 0.028);
    osc.connect(g);
    g.connect(this.dest);
    click.connect(hp);
    hp.connect(cg);
    cg.connect(this.dest);
    osc.start(now);
    osc.stop(now + decay + 0.06);
    click.start(now);
    click.stop(now + 0.05);
  }

  private perc(kit: Kit, vel: number, now: number) {
    const car = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    car.type = "sine";
    mod.type = "sine";
    car.frequency.value = kit.percHz;
    mod.frequency.value = kit.percHz * 1.4;
    const mg = this.ctx.createGain();
    mg.gain.value = kit.percHz * 1.8 * kit.color;
    const g = this.ctx.createGain();
    env(g, now, vel * 0.5, 0.001, 0.09);
    mod.connect(mg);
    mg.connect(car.frequency);
    car.connect(g);
    g.connect(this.dest);
    car.start(now);
    mod.start(now);
    car.stop(now + 0.14);
    mod.stop(now + 0.14);
  }
}
