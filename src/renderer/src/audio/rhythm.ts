// What a song's drums and loudness do over time: how hard kicks, snares and hi-hats hit, how much hits at
// all, and how loud it is. Ported from the mod's old analyse-song.py: the rise in a band's (log) spectrum
// from one moment to the next is a hit in that band, measured against the song's own hits.

/** About this many measurements a second, whatever the song's sample rate. */
const MEASURES_A_SECOND = 86;
const BANDS = { kick: [30, 150], snare: [150, 2500], hat: [5000, 11000], all: [30, 11000] } as const;
/** A hit is the rise above the recent average, over about the last third of a second. */
const AVERAGE_OVER = 32;

export type Rhythm = {
  /** Measurements a second, and the time of the first: each is of the newest sound in its window, so a hit is measured as it starts. */
  rate: number; firstAt: number;
  /** How hard each band hits at each moment, 0 to about 1 (1 is the song's own hard hit). */
  kick: Float32Array; snare: Float32Array; hat: Float32Array; onset: Float32Array;
  /** Loudness (RMS) at each moment. */
  loudness: Float32Array;
};

/** An in-place radix-2 FFT of `re` and `im`, whose length is a power of two. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = -2 * Math.PI / size, wr = Math.cos(angle), wi = Math.sin(angle);
    for (let start = 0; start < n; start += size) {
      let cr = 1, ci = 0;
      for (let k = 0; k < size / 2; k++) {
        const a = start + k, b = a + size / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  }
}

const percentile = (values: Float32Array, p: number) => { const s = Float32Array.from(values).sort(); return s.length ? s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))] : 0; };

/** Rises above the recent average, scaled so the song's hard hits (its top 1%) are 1. */
function hits(flux: Float32Array): Float32Array {
  const out = new Float32Array(flux.length);
  let sum = 0;
  for (let i = 0; i < flux.length; i++) {
    sum += flux[i];
    if (i >= AVERAGE_OVER) sum -= flux[i - AVERAGE_OVER];
    out[i] = Math.max(0, flux[i] - sum / Math.min(i + 1, AVERAGE_OVER));
  }
  const top = percentile(out, 0.99) + 1e-9;
  return out.map(v => v / top);
}

export function rhythmOf(samples: Float32Array, sampleRate: number): Rhythm {
  const hop = Math.max(1, Math.round(sampleRate / MEASURES_A_SECOND));
  let size = 1;
  while (size < hop * 8) size <<= 1;
  const count = Math.max(0, 1 + Math.floor((samples.length - size) / hop));
  const window = Float64Array.from({ length: size }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1)));
  const binsOf = ([lo, hi]: readonly [number, number]) => [Math.max(1, Math.ceil(lo * size / sampleRate)), Math.min(size / 2, Math.floor(hi * size / sampleRate))] as const;
  const bands = Object.fromEntries(Object.entries(BANDS).map(([name, range]) => [name, binsOf(range)])) as Record<keyof typeof BANDS, readonly [number, number]>;
  const flux = Object.fromEntries(Object.keys(BANDS).map(name => [name, new Float32Array(count)])) as Record<keyof typeof BANDS, Float32Array>;
  const loudness = new Float32Array(count);
  const re = new Float64Array(size), im = new Float64Array(size);
  let previous = new Float64Array(size / 2 + 1), current = new Float64Array(size / 2 + 1);
  for (let f = 0; f < count; f++) {
    let squares = 0;
    for (let i = 0; i < size; i++) { const v = samples[f * hop + i]; re[i] = v * window[i]; im[i] = 0; }
    for (let i = 0; i < hop; i++) squares += samples[f * hop + (size - hop) / 2 + i] ** 2;
    loudness[f] = Math.sqrt(squares / hop);
    fft(re, im);
    for (let k = 0; k <= size / 2; k++) current[k] = Math.log1p(Math.hypot(re[k], im[k]) * 10);
    if (f > 0) for (const name of Object.keys(BANDS) as (keyof typeof BANDS)[]) {
      const [lo, hi] = bands[name];
      let rise = 0;
      for (let k = lo; k <= hi; k++) rise += Math.max(0, current[k] - previous[k]);
      flux[name][f] = rise;
    }
    [previous, current] = [current, previous];
  }
  return { rate: sampleRate / hop, firstAt: (size - hop) / sampleRate, kick: hits(flux.kick), snare: hits(flux.snare), hat: hits(flux.hat), onset: hits(flux.all), loudness };
}

const indexAt = (rhythm: Rhythm, time: number) => Math.round((time - rhythm.firstAt) * rhythm.rate);

/** How hard a band hits at a time: the strongest within a couple of measurements either side. */
export function hitAt(band: Float32Array, rhythm: Rhythm, time: number, reach = 2): number {
  const at = indexAt(rhythm, time);
  let best = 0;
  for (let i = Math.max(0, at - reach); i <= Math.min(band.length - 1, at + reach); i++) best = Math.max(best, band[i]);
  return best;
}

/** The time of the strongest hit within `within` seconds of a time, if any is at least `atLeast` hard. */
export function hitNear(rhythm: Rhythm, time: number, within: number, atLeast = 0.35): number | null {
  const from = Math.max(0, indexAt(rhythm, time - within)), to = Math.min(rhythm.onset.length - 1, indexAt(rhythm, time + within));
  let best = -1;
  for (let i = from; i <= to; i++) if (rhythm.onset[i] >= atLeast && (best < 0 || rhythm.onset[i] > rhythm.onset[best])) best = i;
  return best < 0 ? null : best / rhythm.rate + rhythm.firstAt;
}

/** The song's average loudness between two times. */
export function loudnessBetween(rhythm: Rhythm, from: number, to: number): number {
  const i0 = Math.max(0, indexAt(rhythm, from)), i1 = Math.min(rhythm.loudness.length, Math.max(i0 + 1, indexAt(rhythm, to)));
  let sum = 0;
  for (let i = i0; i < i1; i++) sum += rhythm.loudness[i];
  return i1 > i0 ? sum / (i1 - i0) : 0;
}

/** How loud the song usually is: its average loudness, so the gaps between notes don't count as the usual. */
export const usualLoudness = (rhythm: Rhythm): number => rhythm.loudness.length ? rhythm.loudness.reduce((s, v) => s + v, 0) / rhythm.loudness.length : 0;
