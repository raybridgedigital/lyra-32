let taps: number[] = [];

/** Rolling tap-tempo. 2+ taps within 2s; last 6 intervals averaged. Shared across all TAP buttons. */
export function tapTempo(onBpm: (bpm: number) => void, min = 60, max = 180) {
  const now = performance.now();
  if (taps.length && now - taps[taps.length - 1]! > 2000) taps = [];
  taps.push(now);
  if (taps.length > 7) taps = taps.slice(-7);
  if (taps.length < 2) return;
  let sum = 0;
  for (let i = 1; i < taps.length; i++) sum += taps[i]! - taps[i - 1]!;
  const bpm = Math.round(60000 / (sum / (taps.length - 1)));
  onBpm(Math.max(min, Math.min(max, bpm)));
}
