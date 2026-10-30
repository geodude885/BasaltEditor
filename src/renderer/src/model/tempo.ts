import type { TempoChange } from "./types";

/** A chart's tempo: one bpm, or a list of changes by beat. Converts between beats and seconds. */
export class Tempo {
  readonly changes: TempoChange[];
  /** When each change starts, in seconds. */
  readonly starts: number[] = [];

  constructor(bpm: unknown) {
    this.changes = Array.isArray(bpm)
      ? bpm.filter(c => c && c.bpm > 0).map(c => ({ beat: +c.beat || 0, bpm: +c.bpm }))
      : (typeof bpm === "number" && bpm > 0 ? [{ beat: 0, bpm }] : []);
    this.changes.sort((a, b) => a.beat - b.beat);
    if (this.changes.length && this.changes[0].beat !== 0) this.changes.unshift({ beat: 0, bpm: this.changes[0].bpm });
    let s = 0;
    this.changes.forEach((c, i) => {
      if (i > 0) s += (c.beat - this.changes[i - 1].beat) * 60 / this.changes[i - 1].bpm;
      this.starts.push(s);
    });
  }

  get ok(): boolean { return this.changes.length > 0; }

  seconds(beat: number): number {
    let i = this.changes.length - 1;
    while (i > 0 && this.changes[i].beat > beat) i--;
    return this.starts[i] + (beat - this.changes[i].beat) * 60 / this.changes[i].bpm;
  }

  beat(seconds: number): number {
    let i = this.starts.length - 1;
    while (i > 0 && this.starts[i] > seconds) i--;
    return this.changes[i].beat + (seconds - this.starts[i]) * this.changes[i].bpm / 60;
  }

  bpmAt(seconds: number): number {
    let i = this.starts.length - 1;
    while (i > 0 && this.starts[i] > seconds) i--;
    return this.changes[i].bpm;
  }

  /** A time snapped to the nearest `step` beats; unchanged (to the millisecond) with no tempo or step. */
  snap(t: number, step: number): number {
    if (!step || !this.ok) return round(t, 3);
    return round(this.seconds(Math.round(this.beat(t) / step) * step), 4);
  }
}

/** Beats in a bar: charts are in four. */
export const BEATS_PER_BAR = 4;
/** How long a "bar" is where a chart has no tempo, so stepping and selecting by bars still do something. */
export const BAR_WITHOUT_TEMPO_SECONDS = 2;

export const round = (v: number, d: number): number => Math.round(v * 10 ** d) / 10 ** d;

/**
 * A playhead readout that keeps its width as it runs: minutes, then seconds always to `decimals`
 * places ("1:05.20", never "1:5.2"), so a clock beside it doesn't jump about.
 */
export function clockText(seconds: number, decimals = 3): string {
  const t = Math.max(0, seconds), minutes = Math.floor(t / 60);
  let rest = (t - minutes * 60).toFixed(decimals);
  // 59.9996 rounds up to "60.000": carry it into the minutes.
  if (parseFloat(rest) >= 60) return clockText((minutes + 1) * 60, decimals);
  rest = rest.padStart(decimals ? decimals + 3 : 2, "0");
  return `${minutes}:${rest}`;
}

/** A beat readout, counting from 1, always to `decimals` places ("5.00", not "5"). */
export const beatText = (beat: number, decimals = 2): string => (Math.max(0, beat) + 1).toFixed(decimals);

/** The snaps the editor offers, in beats, grouped: straight ones, and triplets' thirds, sixths and twelfths. 0 is off. */
export const SNAPS: { group: string; snaps: [beats: number, label: string][] }[] = [
  { group: "Straight", snaps: [[1, "1 beat"], [1 / 2, "1/2"], [1 / 4, "1/4"], [1 / 8, "1/8"]] },
  { group: "Triplets", snaps: [[1 / 3, "1/3"], [1 / 6, "1/6"], [1 / 12, "1/12"]] },
];

/**
 * The lines a grid draws from beat `from` to `to`, every `step` beats: counted in whole steps, so thirds
 * don't drift (adding 1/3 three times isn't quite 1). Each says whether it is on a beat and on a bar.
 */
export function gridLines(from: number, to: number, step: number, beatsPerBar = BEATS_PER_BAR): { beat: number; whole: boolean; bar: boolean }[] {
  const perBeat = Math.max(1, Math.round(1 / step)), out: { beat: number; whole: boolean; bar: boolean }[] = [];
  for (let n = Math.ceil(from * perBeat); n <= to * perBeat && out.length < 20000; n++) {
    out.push({ beat: n / perBeat, whole: n % perBeat === 0, bar: n % (perBeat * beatsPerBar) === 0 });
  }
  return out;
}
