// A music video's frames, summed up a beat at a time (or every half second without a tempo), with the
// cuts and flashes in it. Times here are the chart's: a frame `time` seconds into the video is at
// `time + offset` in the chart.
import type { Rgb } from "../model/looks";
import type { Tempo } from "../model/tempo";
import { HUE_BINS, type FrameFeatures } from "./frames";

export const SECONDS_A_STEP_WITHOUT_TEMPO = 0.5;
/** A step is at least this long: a fast song steps every two beats (or four), so its looks aren't a blur of cues. */
export const SHORTEST_STEP_SECONDS = 0.4;

/**
 * A sudden change of colours, well above how much they change around it, starts a new shot - if the
 * picture itself changed too, as a flat colour fading across one of the histogram's steps doesn't, and
 * stays changed: a flash that comes back within a few frames is a strobe, not a cut.
 */
const CUT_CHANGE = 0.25, CUT_MOTION = 0.05, CUT_ABOVE_AROUND = 4, CUT_AROUND_FRAMES = 12, CAME_BACK = 0.04;
/** Cuts this close together are one transition. With a tempo, a cut's look lands on the nearest quarter beat, so it hits with the music. */
const CUTS_TOGETHER_SECONDS = 0.25, CUT_SNAPS_TO_BEATS = 0.25;
/** A rise in brightness this big from one frame to the next is one of a strobe's flashes. */
const STROBE_JUMP = 0.12;
/** A jump in brightness that falls back within a few frames is a flash. */
const FLASH_JUMP = 0.12, FLASH_FRAMES = 3;

export type Flash = { time: number; strength: number; colour: Rgb };

export type Step = {
  start: number; end: number;
  luma: number; contrast: number; saturation: number;
  /** How far brightness swings between the step's frames: a strobing video swings a lot, faster than a step. */
  lumaSwing: number;
  /** The step's darkest frame, and how many times brightness jumped up from one frame to the next: a strobe's flashes. */
  lumaLow: number; lumaJumps: number;
  mean: Rgb; hues: number[];
  highlight: Rgb; shadow: Rgb; brightShare: number; brightSoftness: number;
  top: Rgb; topContrast: number; bottomContrast: number;
  vignette: number; edge: Rgb;
  specks: number; speckSize: number; speckColour: Rgb | null; speckHues: number; speckTurnover: number;
  /** Specks in the step's first quarter, against the whole step: above 1 when they spark on the beat. */
  speckOnBeat: number;
  blobs: number; blobRise: number;
  motion: number; motionPeak: number;
  /** The step starts at a cut: a new shot. */
  cut: boolean;
  flash: Flash | null;
};

const median = (values: number[]) => { const s = [...values].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : 0; };

/** Times of cuts, in the video: one for each transition. */
export function cutsIn(frames: FrameFeatures[]): number[] {
  const cuts: number[] = [];
  frames.forEach((f, i) => {
    if (i === 0 || f.change <= CUT_CHANGE || f.motion <= CUT_MOTION) return;
    const around = frames.slice(Math.max(1, i - CUT_AROUND_FRAMES), i + CUT_AROUND_FRAMES).map(x => x.change);
    if (f.change <= median(around) * CUT_ABOVE_AROUND) return;
    // A flash starting (the picture is back a few frames on) or ending (it is as it was a few frames before) isn't a cut.
    const alike = (a: FrameFeatures | undefined, b: FrameFeatures | undefined) =>
      !!a && !!b && Math.abs(a.luma - b.luma) < CAME_BACK && a.mean.every((v, c) => Math.abs(v - b.mean[c]) < CAME_BACK);
    // Too near the end to see whether it lasts, it isn't taken as a cut.
    if (!frames[i + FLASH_FRAMES] || alike(frames[i - 1], frames[i + FLASH_FRAMES])) return;
    if (frames.slice(Math.max(0, i - 1 - FLASH_FRAMES), Math.max(0, i - 1)).some(earlier => alike(earlier, f))) return;
    if (cuts.length && f.time - cuts[cuts.length - 1] < CUTS_TOGETHER_SECONDS) return;
    cuts.push(f.time);
  });
  return cuts;
}

/** Flashes in the video: a frame much brighter than the one before, gone again within a few frames. */
export function flashesIn(frames: FrameFeatures[]): Flash[] {
  const flashes: Flash[] = [];
  for (let i = 1; i < frames.length; i++) {
    const before = frames[i - 1].luma, jump = frames[i].luma - before;
    if (jump <= FLASH_JUMP) continue;
    if (!frames.slice(i + 1, i + 1 + FLASH_FRAMES).some(f => f.luma - before < jump * 0.4)) continue;
    if (flashes.length && frames[i].time - flashes[flashes.length - 1].time < CUTS_TOGETHER_SECONDS) continue;
    flashes.push({ time: frames[i].time, strength: jump, colour: frames[i].highlight });
  }
  return flashes;
}

/** Where each step starts, in the chart, over the video's length: on every beat (every two or four, for a fast song), or every half second without a tempo. */
export function stepTimes(from: number, to: number, tempo: Tempo): number[] {
  const times: number[] = [];
  if (tempo.ok) {
    let beat = Math.max(0, Math.floor(tempo.beat(Math.max(0, from))));
    while (tempo.seconds(beat) < to) {
      let stride = 1;
      while (stride < 4 && tempo.seconds(beat + stride) - tempo.seconds(beat) < SHORTEST_STEP_SECONDS) stride *= 2;
      // Fast stretches step on every second (or fourth) beat, so the steps stay on the bar.
      if (beat % stride) { beat += stride - (beat % stride); continue; }
      times.push(tempo.seconds(beat));
      beat += stride;
    }
  }
  else for (let t = Math.max(0, Math.floor(from / SECONDS_A_STEP_WITHOUT_TEMPO) * SECONDS_A_STEP_WITHOUT_TEMPO); t < to; t += SECONDS_A_STEP_WITHOUT_TEMPO) times.push(t);
  return times;
}

/** Where a cut's look goes, given where the video cuts (chart time): by default, the nearest quarter beat. */
export type CutSnap = (cut: number) => number;
export const snapToQuarterBeats = (tempo: Tempo): CutSnap => cut =>
  tempo.ok ? Math.max(0, tempo.seconds(Math.round(tempo.beat(cut) / CUT_SNAPS_TO_BEATS) * CUT_SNAPS_TO_BEATS)) : cut;

export function stepsOf(frames: FrameFeatures[], offset: number, tempo: Tempo, snapCut: CutSnap = snapToQuarterBeats(tempo)): Step[] {
  if (!frames.length) return [];
  const cuts = cutsIn(frames).map(t => t + offset), flashes = flashesIn(frames).map(f => ({ ...f, time: f.time + offset }));
  const last = frames[frames.length - 1].time + offset, times = stepTimes(frames[0].time + offset, last, tempo);
  // Where each cut's step starts (snapped), and the real cut its frames start from, so a step never mixes two shots.
  const framesFrom = new Map<number, number>();
  for (const cut of cuts) {
    if (cut < 0) continue;
    const snapped = Math.max(0, snapCut(cut));
    if (framesFrom.has(snapped)) continue;
    const at = times.findIndex(t => Math.abs(t - snapped) < 1e-6);
    if (at < 0) times.push(snapped);
    framesFrom.set(snapped, cut);
  }
  times.sort((a, b) => a - b);
  const firstFrame = (k: number) => framesFrom.get(times[k]) ?? times[k];
  const steps: Step[] = [];
  let next = 0;
  times.forEach((start, k) => {
    const end = times[k + 1] ?? last + 1e-6, from = firstFrame(k), to = k + 1 < times.length ? firstFrame(k + 1) : end;
    next = 0;
    while (next < frames.length && frames[next].time + offset < from) next++;
    const inStep: FrameFeatures[] = [];
    for (let i = next; i < frames.length && frames[i].time + offset < to; i++) inStep.push(frames[i]);
    if (!inStep.length) return;
    const avg = (read: (f: FrameFeatures) => number) => inStep.reduce((s, f) => s + read(f), 0) / inStep.length;
    const avgRgb = (read: (f: FrameFeatures) => Rgb): Rgb => [0, 1, 2].map(c => avg(f => read(f)[c])) as Rgb;
    const withSpecks = inStep.filter(f => f.speckColour);
    const firstQuarter = inStep.filter(f => f.time + offset < start + (end - start) / 4);
    const specks = avg(f => f.specks);
    const flash = flashes.filter(f => f.time >= start && f.time < end).sort((a, b) => b.strength - a.strength)[0] ?? null;
    steps.push({
      start, end,
      luma: avg(f => f.luma), contrast: avg(f => f.contrast), saturation: avg(f => f.saturation),
      lumaSwing: Math.max(...inStep.map(f => f.luma)) - Math.min(...inStep.map(f => f.luma)),
      lumaLow: Math.min(...inStep.map(f => f.luma)),
      lumaJumps: inStep.filter(f => f.rise > STROBE_JUMP).length,
      mean: avgRgb(f => f.mean), hues: Array.from({ length: HUE_BINS }, (_, bin) => avg(f => f.hues[bin])),
      highlight: avgRgb(f => f.highlight), shadow: avgRgb(f => f.shadow), brightShare: avg(f => f.brightShare), brightSoftness: avg(f => f.brightSoftness),
      top: avgRgb(f => f.top), topContrast: avg(f => f.topContrast), bottomContrast: avg(f => f.bottomContrast),
      vignette: avg(f => f.vignette), edge: avgRgb(f => f.edge),
      specks, speckSize: avg(f => f.speckSize), speckHues: avg(f => f.speckHues), speckTurnover: avg(f => f.speckTurnover),
      speckColour: withSpecks.length ? [0, 1, 2].map(c => withSpecks.reduce((s, f) => s + f.speckColour![c], 0) / withSpecks.length) as Rgb : null,
      speckOnBeat: specks > 0 && firstQuarter.length ? firstQuarter.reduce((s, f) => s + f.specks, 0) / firstQuarter.length / specks : 1,
      blobs: avg(f => f.blobs), blobRise: avg(f => f.blobRise),
      motion: avg(f => f.motion), motionPeak: Math.max(...inStep.map(f => f.motion)),
      cut: framesFrom.has(start),
      flash,
    });
  });
  return steps;
}
