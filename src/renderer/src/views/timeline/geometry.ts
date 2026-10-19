// The timeline's rows, its time-to-pixel mapping, and where each event's marker sits.
import { evTime, laneOf } from "../../model/chart";
import type { Tempo } from "../../model/tempo";
import type { TimedLookCue } from "../../model/looks";
import type { LoadedChart } from "../../model/types";

export const TIMELINE_ROWS = ["ruler", "wave", "phase", "look", "shot", "move", "clip"] as const;
export type TimelineRow = (typeof TIMELINE_ROWS)[number];

export const COLLAPSIBLE_ROWS: { row: TimelineRow; label: string }[] = [
  { row: "wave", label: "Song" }, { row: "phase", label: "Phases" }, { row: "look", label: "Looks" },
  { row: "shot", label: "Projectiles" }, { row: "move", label: "Moves · spots" }, { row: "clip", label: "Recorded" },
];

const EXPANDED_ROW_HEIGHT_PIXELS: Record<TimelineRow, number> = { ruler: 22, wave: 58, phase: 22, look: 34, shot: 46, move: 34, clip: 30 };
export const COLLAPSED_ROW_HEIGHT_PIXELS = 10;
// The resize handle's extra height goes to the rows that use it.
const SHARE_OF_EXTRA_HEIGHT: Partial<Record<TimelineRow, number>> = { wave: 0.35, look: 0.2, shot: 0.45 };
export const MOST_EXTRA_TIMELINE_HEIGHT_PIXELS = 400;

export type RowSpan = readonly [top: number, height: number];
export type TimelineLayout = { rows: Record<TimelineRow, RowSpan>; height: number; collapsed: ReadonlySet<TimelineRow> };

export function layoutTimeline(collapsed: ReadonlySet<TimelineRow>, extraHeightPixels: number): TimelineLayout {
  const growing = TIMELINE_ROWS.filter(row => SHARE_OF_EXTRA_HEIGHT[row] && !collapsed.has(row));
  const totalShare = growing.reduce((sum, row) => sum + SHARE_OF_EXTRA_HEIGHT[row]!, 0);
  const rows = {} as Record<TimelineRow, RowSpan>;
  let top = 0;
  for (const row of TIMELINE_ROWS) {
    const extra = growing.includes(row) ? Math.round(extraHeightPixels * SHARE_OF_EXTRA_HEIGHT[row]! / totalShare) : 0;
    const height = collapsed.has(row) ? COLLAPSED_ROW_HEIGHT_PIXELS : EXPANDED_ROW_HEIGHT_PIXELS[row] + extra;
    rows[row] = [top, height];
    top += height;
  }
  return { rows, height: top, collapsed };
}

export type View = { t0: number; pps: number };
export const xOf = (v: View, t: number): number => (t - v.t0) * v.pps;
export const tOf = (v: View, x: number): number => x / v.pps + v.t0;

export const inRow = (layout: TimelineLayout, row: TimelineRow, y: number): boolean =>
  y >= layout.rows[row][0] && y < layout.rows[row][0] + layout.rows[row][1];

export type Marker = { i: number; x: number; y: number };

/**
 * Where each event's marker is drawn: projectiles in four rows by where they start across the lane,
 * moves and spots in theirs - and markers that would land on one another (the same time and row)
 * fanned out sideways, so every one can be seen and clicked.
 */
export function markers(c: LoadedChart, tp: Tempo, view: View, layout: TimelineLayout): Marker[] {
  const out: Marker[] = [], taken = new Map<string, number>(), lanes = 4, step = 8, width = laneOf(c).width;
  const [shotTop, shotHeight] = layout.rows.shot, [moveTop, moveHeight] = layout.rows.move;
  c.events.forEach((e, i) => {
    const t = evTime(e, tp);
    if (!Number.isFinite(t)) return;
    const x = xOf(view, t);
    let y: number;
    if (e.projectile) {
      const lane = Math.min(lanes - 1, Math.max(0, Math.round(((+e.projectile.from?.x || 0) / width + 0.5) * (lanes - 1))));
      y = layout.collapsed.has("shot") ? shotTop + shotHeight / 2 : shotTop + 7 + lane * ((shotHeight - 14) / (lanes - 1));
    } else {
      y = moveTop + moveHeight / 2;
    }
    const key = `${Math.round(x / 3)}:${y}`, n = taken.get(key) ?? 0;
    taken.set(key, n + 1);
    out.push({ i, x: x + n * step, y });
  });
  return out;
}

/** The events under a point, nearest first (markers are about 12 px). */
export function eventsAt(all: Marker[], x: number, y: number): number[] {
  return all.map(m => ({ i: m.i, d: Math.hypot(m.x - x, m.y - y) })).filter(m => m.d <= 9).sort((a, b) => a.d - b.d).map(m => m.i);
}

export const LOOK_MARKER_HIT_PIXELS = 7;

export function lookCueAt(cues: TimedLookCue[], view: View, x: number): number {
  let nearest = -1, nearestDistance = LOOK_MARKER_HIT_PIXELS;
  for (const cue of cues) {
    const distance = Math.abs(xOf(view, cue.time) - x);
    if (distance <= nearestDistance) { nearest = cue.index; nearestDistance = distance; }
  }
  return nearest;
}
