// Recorded tracks: at most one per actor, each a list of clips played one after another. The timeline
// shows a row of clips per track, in the order of the actors list; tracks never cut each other off.
import { actorsOf, firstActorId } from "./chart";
import type { Tempo } from "./tempo";
import type { LoadedChart, TrackClip } from "./types";

/** A row of the timeline's recorded clips: a track (its index in `tracks`), whose actor it is, and the row's label. */
export type TrackRow = { track: number; actor: string; label: string };

/** The track a chart's actor plays, if any (a track without `actor` is the first actor's). */
export const trackOfActor = (c: LoadedChart, actorId: string): number =>
  (c.tracks ?? []).findIndex(track => (track.actor ?? firstActorId(c)) === actorId);

/**
 * One row per track, in the order of the actors list - a track for an actor that doesn't exist (a load
 * error in the mod) comes last, labelled by its id. Labelled by the actor's name, else its id.
 */
export function trackRows(c: LoadedChart): TrackRow[] {
  const actors = actorsOf(c), first = firstActorId(c);
  return (c.tracks ?? [])
    .map((track, index) => {
      const actor = track.actor ?? first, at = actors.findIndex(a => a.id === actor);
      return { row: { track: index, actor, label: (at >= 0 && actors[at].name) || actor }, order: at < 0 ? actors.length : at };
    })
    .sort((a, b) => a.order - b.order || a.row.track - b.row.track)
    .map(({ row }) => row);
}

/** When a clip starts on the chart's timeline, in seconds. */
export const clipStart = (k: TrackClip, tp: Tempo): number => k.t ?? (tp.ok && k.beat != null ? tp.seconds(k.beat) : 0);

/** A clip as drawn: when it starts and stops on the chart's timeline, and whether it is mimed. */
export type PlayedClip = { clip: string; start: number; stop: number; mime: boolean };

/**
 * A track's clips as they play: each from its start until the next clip in the same track starts, or
 * until its own `to` (or the end of its recording, else the chart's end) - whichever is first.
 * `recordingEnd` is how long a clip's recording runs, when its file is open.
 */
export function playedClips(clips: TrackClip[], tp: Tempo, chartEnd: number, recordingEnd: (clip: string) => number | undefined): PlayedClip[] {
  return clips.map((k, i) => {
    const start = clipStart(k, tp), from = k.from ?? 0, recorded = recordingEnd(k.clip);
    let stop = k.to != null ? start + (k.to - from) : recorded != null ? start + (recorded - from) : chartEnd;
    if (i + 1 < clips.length) stop = Math.min(stop, clipStart(clips[i + 1], tp));
    return { clip: k.clip, start, stop, mime: !!k.mime };
  });
}

/** What the mod refuses in `tracks`: a second track for an actor, an actor that doesn't exist, clips out of order or misshapen. */
export function trackProblems(c: LoadedChart, tp: Tempo): string[] {
  const out: string[] = [], ids = new Set(actorsOf(c).map(a => a.id)), first = firstActorId(c), seen = new Set<string>();
  (c.tracks ?? []).forEach((track, i) => {
    const actor = track.actor ?? first;
    if (!ids.has(actor)) out.push(`tracks[${i}].actor "${actor}" is not one of the actors`);
    if (seen.has(actor)) out.push(`tracks[${i}]: "${actor}" already has a track (one per actor)`);
    seen.add(actor);
    let before = -Infinity;
    (track.clips ?? []).forEach((k, j) => {
      const p = `tracks[${i}].clips[${j}]`;
      if (k.t == null && k.beat == null) out.push(`${p} needs t or beat`);
      else {
        const start = clipStart(k, tp);
        if (!(start > before)) out.push(`${p} must start after the clip before it`);
        before = start;
      }
      if (!k.clip) out.push(`${p} needs a clip`);
      if (k.from != null && k.from < 0) out.push(`${p}.from cannot be negative`);
      if (k.to != null && !(k.to > (k.from ?? 0))) out.push(`${p}.to must be after from`);
    });
  });
  return out;
}
