// What a press on the timeline means - a plain function the component applies.
import { phaseTime } from "../../model/chart";
import type { TimedLookCue } from "../../model/looks";
import type { Tempo } from "../../model/tempo";
import type { LoadedChart } from "../../model/types";
import { normalise, type Box } from "../theme";
import { columnAtY, eventsAt, inRow, lookCuesAt, tOf, xOf, type Marker, type TimelineLayout, type View } from "./geometry";

export type TimelinePress =
  | { kind: "seek" }
  | { kind: "seek-and-clear-selection" }
  | { kind: "select-phase"; index: number }
  | { kind: "select-look-cues"; underPointer: number[] }
  | { kind: "add-look-cue" }
  | { kind: "select-events"; underPointer: number[] }
  | { kind: "add-projectile" }
  | { kind: "add-move" }
  | { kind: "box-select" };

export function phaseIndexAt(chart: LoadedChart, tempo: Tempo, seconds: number): number {
  const phases = chart.phases ?? [];
  return phases.findIndex((p, i) => phaseTime(p, tempo) <= seconds && (i + 1 >= phases.length || phaseTime(phases[i + 1], tempo) > seconds));
}

export function whatATimelinePressHits(
  chart: LoadedChart, tempo: Tempo, view: View, layout: TimelineLayout, markers: Marker[], lookCues: TimedLookCue[],
  x: number, y: number, doubleClick: boolean,
): TimelinePress {
  if (y < layout.rows.phase[0]) return { kind: "seek" };
  if (inRow(layout, "phase", y)) return { kind: "select-phase", index: phaseIndexAt(chart, tempo, tOf(view, x)) };
  if (inRow(layout, "look", y)) {
    const underPointer = lookCuesAt(lookCues, view, x);
    if (underPointer.length) return { kind: "select-look-cues", underPointer };
    return doubleClick ? { kind: "add-look-cue" } : { kind: "box-select" };
  }
  const underPointer = eventsAt(markers, x, y);
  if (underPointer.length) return { kind: "select-events", underPointer };
  if (doubleClick && inRow(layout, "shot", y)) return { kind: "add-projectile" };
  if (doubleClick && inRow(layout, "move", y)) return { kind: "add-move" };
  if (inRow(layout, "shot", y) || inRow(layout, "move", y)) return { kind: "box-select" };
  return { kind: "seek-and-clear-selection" };
}

/**
 * On a touch screen, a press on empty space waits to see what it becomes - a tap adds there, a drag
 * pans, a long press box-selects - instead of acting as soon as the finger lands.
 */
export const pressWaitsOnTouch = (press: TimelinePress): boolean =>
  press.kind === "box-select" || press.kind === "seek-and-clear-selection";

export type TouchTap =
  | { kind: "add-projectile"; column: number }
  | { kind: "add-look-cue" }
  | { kind: "add-move" }
  | { kind: "seek-and-clear-selection" };

/** What a tap on empty space adds: whatever that row holds - a projectile in the column tapped. */
export function whatATouchTapAdds(layout: TimelineLayout, y: number): TouchTap {
  if (inRow(layout, "shot", y)) return { kind: "add-projectile", column: columnAtY(layout, y) };
  if (inRow(layout, "look", y)) return { kind: "add-look-cue" };
  if (inRow(layout, "move", y)) return { kind: "add-move" };
  return { kind: "seek-and-clear-selection" };
}

/**
 * What a tap on empty space does, given the selection: with something selected (and not adding to
 * it), a tap that would add something just lets go of the selection first.
 */
export function touchTapWith(tap: TouchTap, hasSelection: boolean, adding: boolean): TouchTap | { kind: "let-go" } {
  return hasSelection && !adding && tap.kind !== "seek-and-clear-selection" ? { kind: "let-go" } : tap;
}

export function markersInBox(markers: Marker[], box: Box): number[] {
  const b = normalise(box);
  return markers.filter(m => m.x >= b.x0 && m.x <= b.x1 && m.y >= b.y0 && m.y <= b.y1).map(m => m.i);
}

/** The looks a box takes in: it needs only to reach their row, where each runs the row's full height. */
export function lookCuesInBox(cues: TimedLookCue[], view: View, layout: TimelineLayout, box: Box): number[] {
  const b = normalise(box), [top, height] = layout.rows.look;
  if (b.y1 < top || b.y0 > top + height) return [];
  return cues.filter(cue => { const x = xOf(view, cue.time); return x >= b.x0 && x <= b.x1; }).map(cue => cue.index);
}
