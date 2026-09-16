function clamp1(n: number) {
  return Math.max(-1, Math.min(1, n));
}

export function encodeWavStereo(left: Float32Array, right: Float32Array, sampleRate: number): Blob {
  const n = Math.min(left.length, right.length);
  const bytes = n * 4;
  const buf = new ArrayBuffer(44 + bytes);
  const v = new DataView(buf);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  v.setUint32(4, 36 + bytes, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 2, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 4, true);
  v.setUint16(32, 4, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, bytes, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    v.setInt16(o, Math.round(clamp1(left[i]!) * 32767), true);
    v.setInt16(o + 2, Math.round(clamp1(right[i]!) * 32767), true);
    o += 4;
  }
  return new Blob([buf], { type: "audio/wav" });
}

export function mergeChunks(chunks: Float32Array[]) {
  let n = 0;
  for (const c of chunks) n += c.length;
  const out = new Float32Array(n);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
