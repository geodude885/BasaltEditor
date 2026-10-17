/** A song's loudest sample in each slice of `1 / rate` seconds, for drawing its waveform. */
export type Peaks = { rate: number; max: Float32Array };

export function buildPeaks(channel: Float32Array, sampleRate: number, rate = 200): Peaks {
  const step = Math.max(1, Math.floor(sampleRate / rate)), max = new Float32Array(Math.ceil(channel.length / step));
  for (let i = 0; i < max.length; i++) {
    let m = 0;
    for (let j = i * step, e = Math.min(channel.length, j + step); j < e; j++) m = Math.max(m, Math.abs(channel[j]));
    max[i] = m;
  }
  return { rate, max };
}

/** The loudest peak between two song times, 0 to 1. */
export function peakBetween(peaks: Peaks, from: number, to: number): number {
  const i0 = Math.max(0, Math.floor(from * peaks.rate)), i1 = Math.min(peaks.max.length, Math.ceil(to * peaks.rate));
  let m = 0;
  for (let i = i0; i < i1; i++) m = Math.max(m, peaks.max[i]);
  return m;
}
