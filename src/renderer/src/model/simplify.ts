// Keeping only the moments that matter in something that fades in straight lines from one moment to the next, as looks
// do: a moment is kept when fading straight from the one kept before it to the one kept after would miss it by more than
// a tolerance (Ramer-Douglas-Peucker, as drawing programs use to thin out a path). Everything else would be reproduced by
// the fade anyway. The video converter thins its beats this way; simplifyLooks does it to looks already in a chart.
import { evTime, setEvTime } from "./chart";
import { feltVector, settingDistance } from "./lookImpact";
import { findPackParameter, isCueForPack, setStageCueSetting, settingsWrittenIn, STAGE_PACK, stageLookAt, timedLookCues, type PackParameter } from "./looks";
import type { Tempo } from "./tempo";
import type { LoadedChart, LookCue } from "./types";

/**
 * Which of these moments to keep. `values` are each moment's settings, felt (0 to 1, so one tolerance fits them all);
 * `mustKeep` marks moments that stay whatever - a cut, the first and last are always kept. Indices, in order.
 */
export function keyMoments(times: readonly number[], values: readonly (readonly number[])[], tolerance: number, mustKeep: (i: number) => boolean = () => false): number[] {
  const n = times.length;
  if (n <= 2) return [...Array(n).keys()];
  const kept = new Set<number>([0, n - 1]);
  for (let i = 1; i < n - 1; i++) if (mustKeep(i)) kept.add(i);

  // How far moment j is from the straight fade between a and b: the most any setting is off.
  const miss = (a: number, b: number, j: number) => {
    const span = times[b] - times[a], k = span > 0 ? (times[j] - times[a]) / span : 0;
    let most = 0;
    for (let d = 0; d < values[j].length; d++) most = Math.max(most, Math.abs(values[j][d] - (values[a][d] + (values[b][d] - values[a][d]) * k)));
    return most;
  };
  const split = (a: number, b: number) => {
    let worst = -1, worstMiss = tolerance;
    for (let j = a + 1; j < b; j++) { const m = miss(a, b, j); if (m > worstMiss) { worst = j; worstMiss = m; } }
    if (worst < 0) return;
    kept.add(worst);
    split(a, worst);
    split(worst, b);
  };
  const anchors = [...kept].sort((a, b) => a - b);
  for (let i = 0; i + 1 < anchors.length; i++) split(anchors[i], anchors[i + 1]);
  return [...kept].sort((a, b) => a - b);
}

/** How closely Simplify keeps to the looks it replaces: within this share of any setting's range, felt. */
export const SIMPLIFY_TOLERANCE = 0.06;
export const SIMPLIFY_CLOSENESS: readonly { label: string; tolerance: number }[] = [
  { label: "Close", tolerance: SIMPLIFY_TOLERANCE }, { label: "Loose", tolerance: 0.15 }, { label: "Rough", tolerance: 0.3 },
];
/** A cue this quick is a cut, and stays one. */
const CUT_SECONDS = 0.06;

export type Simplified = { remove: number[]; add: LookCue[] };

/**
 * Fewer BossBattles Stage looks in place of these (indices into the chart's looks) that look much the same: each kept
 * one reaches what the look was at that moment, fading from the one kept before, as the originals did. With `merge`, one
 * look in place of them all, fading from the first's time to where the last ends. Looks for other packs, and ones that
 * turn the pack off, are left as they are.
 */
export function simplifyLooks(chart: LoadedChart, tempo: Tempo, indices: Iterable<number>, { merge = false, tolerance = SIMPLIFY_TOLERANCE }: { merge?: boolean; tolerance?: number } = {}): Simplified {
  const shaders = chart.shaders ?? [];
  const run = [...new Set(indices)].filter(i => shaders[i] && isCueForPack(shaders[i], STAGE_PACK) && !shaders[i].off)
    .map(i => ({ index: i, cue: shaders[i], time: evTime(shaders[i], tempo) })).filter(r => Number.isFinite(r.time)).sort((a, b) => a.time - b.time);
  if (run.length < 2) return { remove: [], add: [] };

  // The settings any of them set: the only ones the new looks write.
  const parameters = STAGE_PACK.parameters.filter(p => run.some(r => settingsWrittenIn(r.cue).some(([name]) => findPackParameter(STAGE_PACK, name) === p)));
  const timed = timedLookCues(chart, tempo);
  // The look as it is now, where each of them starts fading and where it gets to: between those it holds or fades in a
  // straight line, so these moments are all it is.
  const moments = [...new Set(run.flatMap(r => [r.time, r.time + (r.time > 0 ? r.cue.fade ?? 0 : 0)]))].sort((a, b) => a - b);
  const sampled = moments.map(m => stageLookAt(timed, m + 1e-6));
  const looks = sampled.map(look => look.settings);
  // A cut's start and end stay, so it stays a cut.
  const cuts = new Set(run.filter(r => r.time > 0 && (r.cue.fade ?? 0) <= CUT_SECONDS).flatMap(r => [moments.indexOf(r.time), moments.indexOf(r.time + (r.cue.fade ?? 0))]));
  const keys = merge ? [0, moments.length - 1] : keyMoments(moments, looks.map(s => feltVector(s, parameters)), tolerance, i => cuts.has(i));
  // Without these, the pack may be off where they start: then the first new look turns it on, with all of its settings.
  const replaced = new Set(run.map(r => r.index));
  const startsOff = !stageLookAt(timed.filter(c => !replaced.has(c.index)), moments[0] + 1e-6).on;

  const inBeats = tempo.ok && run.every(r => r.cue.beat != null);
  const make = (time: number, fade: number, write: readonly PackParameter[], settings: Record<string, number>): LookCue => {
    const cue = (inBeats ? { beat: 0, pack: STAGE_PACK.name } : { t: 0, pack: STAGE_PACK.name }) as LookCue;
    setEvTime(cue, time, tempo);
    if (fade > 0.0005) cue.fade = Math.round(fade * 1000) / 1000;
    for (const p of write) setStageCueSetting(cue, p, settings[p.property]);
    return cue;
  };

  // A look for each stretch between two kept moments: starting at the first, fading to what the look is at the second.
  // The first one writes everything (and a merge's only one does); the rest only what moved, as the rest carries on.
  const add: LookCue[] = [];
  if (startsOff && !merge) add.push(make(moments[0], 0, parameters, looks[0]));
  for (let n = 1; n < keys.length; n++) {
    const a = keys[n - 1], b = keys[n], whole = add.length === 0 && merge;
    const moved = whole ? parameters : parameters.filter(p => settingDistance(p, looks[a], looks[b]) > tolerance / 3);
    if (moved.length) add.push(make(moments[a], moments[b] - moments[a], moved, looks[b]));
  }
  if (!add.length) add.push(make(moments[0], 0, parameters, looks[keys.at(-1)!]));
  return { remove: run.map(r => r.index), add };
}
