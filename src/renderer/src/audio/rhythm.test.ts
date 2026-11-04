import { describe, expect, it } from "vitest";
import { fft, hitAt, hitNear, loudnessBetween, rhythmOf, usualLoudness } from "./rhythm";

const RATE = 22050;
/** A song of silence with sounds added: each a tone at a frequency, starting at a time and dying away. */
function song(seconds: number, sounds: { at: number; hz: number; loud?: number }[]): Float32Array {
  const out = new Float32Array(Math.round(seconds * RATE));
  for (const { at, hz, loud = 0.8 } of sounds) {
    const start = Math.round(at * RATE);
    for (let i = 0; i < RATE * 0.15 && start + i < out.length; i++) out[start + i] += loud * Math.sin(2 * Math.PI * hz * i / RATE) * Math.exp(-i / (RATE * 0.04));
  }
  return out;
}

describe("the FFT", () => {
  it("finds a tone in its own bin", () => {
    const n = 64, re = Float64Array.from({ length: n }, (_, i) => Math.cos(2 * Math.PI * 5 * i / n)), im = new Float64Array(n);
    fft(re, im);
    const magnitudes = Array.from(re, (v, k) => Math.hypot(v, im[k]));
    expect(magnitudes.indexOf(Math.max(...magnitudes.slice(0, n / 2)))).toBe(5);
    expect(magnitudes[5]).toBeCloseTo(n / 2);
  });
});

describe("a song's rhythm", () => {
  const beats = [0.5, 1, 1.5, 2, 2.5, 3];
  const kicks = beats.map(at => ({ at, hz: 60 })), hats = beats.map(at => ({ at: at + 0.25, hz: 8000, loud: 0.3 }));
  const r = rhythmOf(song(4, [...kicks, ...hats]), RATE);

  it("hears kicks as kicks and hi-hats as hi-hats", () => {
    expect(hitAt(r.kick, r, 1)).toBeGreaterThan(0.5);
    expect(hitAt(r.kick, r, 1.25)).toBeLessThan(0.2);
    expect(hitAt(r.hat, r, 1.25)).toBeGreaterThan(0.5);
    expect(hitAt(r.hat, r, 1)).toBeLessThan(0.2);
  });

  it("finds the hit nearest a time, and none in silence", () => {
    expect(hitNear(r, 1.32, 0.15)).toBeCloseTo(1.25, 1);
    expect(hitNear(rhythmOf(song(2, []), RATE), 1, 0.15)).toBeNull();
  });

  it("measures how loud it is, against how loud it usually is", () => {
    const quietThenLoud = rhythmOf(song(4, [0.25, 0.5, 0.75, 1, 2.25, 2.5, 2.75, 3].map((at, i) => ({ at, hz: 200, loud: i < 4 ? 0.1 : 0.9 }))), RATE);
    expect(loudnessBetween(quietThenLoud, 2, 3.2)).toBeGreaterThan(loudnessBetween(quietThenLoud, 0, 1.2) * 4);
    expect(usualLoudness(quietThenLoud)).toBeGreaterThanOrEqual(0);
  });
});
