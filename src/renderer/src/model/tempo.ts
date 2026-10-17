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

export const round = (v: number, d: number): number => Math.round(v * 10 ** d) / 10 ** d;
