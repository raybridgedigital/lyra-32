import type { Patch } from "./types";
import { clonePatch, mx, patch } from "./patch-kit";
import { EXTRA_FACTORY } from "./factory-extra";
import { EXTRA_V43 } from "./factory-v43";
import { CATEGORY_ORDER } from "./patch-kit";

export { clonePatch, CATEGORY_ORDER };

const baseFx = {
  delayMix: 0.12,
  delayTime: 0.28,
  delayFeedback: 0.28,
  reverbMix: 0.18,
  chorusMix: 0.08,
  phaserMix: 0.06,
};
