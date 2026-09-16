/** Screen wake lock + a silent audio tap so Chrome does not nap the tab. Off by default — cheap when unused. */

export function startStageKeepAlive(ctx: AudioContext | null): () => void {
  let dead = false;
  let sentinel: WakeLockSentinel | null = null;
  let osc: OscillatorNode | null = null;
  let gain: GainNode | null = null;

  const grab = async () => {
    if (dead || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    try {
      sentinel = await navigator.wakeLock.request("screen");
      sentinel.addEventListener("release", () => {
        if (!dead && document.visibilityState === "visible") void grab();
      });
    } catch {
      /* permission, battery saver, unsupported */
    }
  };

  if (ctx) {
    try {
      gain = ctx.createGain();
      gain.gain.value = 0.00002;
      osc = ctx.createOscillator();
      osc.frequency.value = 18;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      void ctx.resume();
    } catch {
      /* */
    }
  }

  const vis = () => {
    if (document.visibilityState !== "visible") return;
    void grab();
    void ctx?.resume();
  };
  document.addEventListener("visibilitychange", vis);
  void grab();

  return () => {
    dead = true;
    document.removeEventListener("visibilitychange", vis);
    try {
      void sentinel?.release();
    } catch {
      /* */
    }
    sentinel = null;
    try {
      osc?.stop();
      osc?.disconnect();
      gain?.disconnect();
    } catch {
      /* */
    }
    osc = null;
    gain = null;
  };
}
