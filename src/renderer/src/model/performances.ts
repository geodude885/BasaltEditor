// Recorded performances: at most one per actor, each a list of clips played one after another. The timeline
// shows a row of clips per performance, in the order of the actors list; they never cut each other off.
import { actorsOf, firstActorId } from "./chart";
import type { Tempo } from "./tempo";
import type { LoadedChart, PerformanceClip } from "./types";

/** A row of the timeline's recorded clips: a performance (its index in `performances`), whose actor it is, and the row's label. */
export type PerformanceRow = { performance: number; actor: string; label: string };

/** The performance a chart's actor plays, if any (one without `actor` is the first actor's). */
export const performanceOfActor = (c: LoadedChart, actorId: string): number =>
  (c.performances ?? []).findIndex(performance => (performance.actor ?? firstActorId(c)) === actorId);

/**
 * One row per performance, in the order of the actors list - one for an actor that doesn't exist (a load
 * error in the mod) comes last, labelled by its id. Labelled by the actor's name, else its id.
 */
export function performanceRows(c: LoadedChart): PerformanceRow[] {
  const actors = actorsOf(c), first = firstActorId(c);
  return (c.performances ?? [])
    .map((performance, index) => {
      const actor = performance.actor ?? first, at = actors.findIndex(a => a.id === actor);
      return { row: { performance: index, actor, label: (at >= 0 && actors[at].name) || actor }, order: at < 0 ? actors.length : at };
    })
    .sort((a, b) => a.order - b.order || a.row.performance - b.row.performance)
    .map(({ row }) => row);
}

/** When a clip starts on the chart's timeline, in seconds. */
export const clipStart = (k: PerformanceClip, tp: Tempo): number => k.t ?? (tp.ok && k.beat != null ? tp.seconds(k.beat) : 0);

/** A clip as drawn: when it starts and stops on the chart's timeline, and whether it is mimed. */
export type PlayedClip = { clip: string; start: number; stop: number; mime: boolean };

/**
 * A performance's clips as they play: each from its start until the next clip in the same performance
 * starts, or until its own `end` (or the end of its recording, else the chart's end) - whichever is first.
 * `recordingEnd` is how long a clip's recording runs, when its file is open.
 */
export function playedClips(clips: PerformanceClip[], tp: Tempo, chartEnd: number, recordingEnd: (clip: string) => number | undefined): PlayedClip[] {
  return clips.map((k, i) => {
    const start = clipStart(k, tp), from = k.start ?? 0, recorded = recordingEnd(k.clip);
    let stop = k.end != null ? start + (k.end - from) : recorded != null ? start + (recorded - from) : chartEnd;
    if (i + 1 < clips.length) stop = Math.min(stop, clipStart(clips[i + 1], tp));
    return { clip: k.clip, start, stop, mime: !!k.mime };
  });
}

/** What the mod refuses in `performances`: a second performance for an actor, an actor that doesn't exist, clips out of order or misshapen. */
export function performanceProblems(c: LoadedChart, tp: Tempo): string[] {
  const out: string[] = [], ids = new Set(actorsOf(c).map(a => a.id)), first = firstActorId(c), seen = new Set<string>();
  (c.performances ?? []).forEach((performance, i) => {
    const actor = performance.actor ?? first;
    if (!ids.has(actor)) out.push(`performances[${i}].actor "${actor}" is not one of the actors`);
    if (seen.has(actor)) out.push(`performances[${i}]: "${actor}" already has a performance (one per actor)`);
    seen.add(actor);
    let before = -Infinity;
    (performance.clips ?? []).forEach((k, j) => {
      const p = `performances[${i}].clips[${j}]`;
      if (k.t == null && k.beat == null) out.push(`${p} needs t or beat`);
      else {
        const start = clipStart(k, tp);
        if (!(start > before)) out.push(`${p} must start after the clip before it`);
        before = start;
      }
      if (!k.clip) out.push(`${p} needs a clip`);
      if (k.start != null && k.start < 0) out.push(`${p}.start cannot be negative`);
      if (k.end != null && !(k.end > (k.start ?? 0))) out.push(`${p}.end must be after start`);
    });
  });
  return out;
}
