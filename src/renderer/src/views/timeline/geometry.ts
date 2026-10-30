// The timeline's rows, its time-to-pixel mapping, and where each event's marker sits.
import { evTime, laneOf } from "../../model/chart";
import { PROJECTILE_COLUMNS } from "../../model/columns";
import type { Tempo } from "../../model/tempo";
import type { TimedLookCue } from "../../model/looks";
import type { LoadedChart } from "../../model/types";

export const TIMELINE_ROWS = ["ruler", "wave", "phase", "look", "shot", "move", "clip"] as const;
export type TimelineRow = (typeof TIMELINE_ROWS)[number];

export const COLLAPSIBLE_ROWS: { row: TimelineRow; label: string }[] = [
  { row: "wave", label: "Song" }, { row: "phase", label: "Phases" }, { row: "look", label: "Looks" },
  { row: "shot", label: "Projectiles" }, { row: "move", label: "Moves · spots" }, { row: "clip", label: "Recorded" },
];

const EXPANDED_ROW_HEIGHT_PIXELS: Record<TimelineRow, number> = { ruler: 22, wave: 58, phase: 22, look: 34, shot: 54, move: 34, clip: 30 };
export const COLLAPSED_ROW_HEIGHT_PIXELS = 10;
// The resize handle's extra height goes to the rows that use it.
const SHARE_OF_EXTRA_HEIGHT: Partial<Record<TimelineRow, number>> = { wave: 0.35, look: 0.2, shot: 0.45 };
export const MOST_EXTRA_TIMELINE_HEIGHT_PIXELS = 400;

export type RowSpan = readonly [top: number, height: number];
/**
 * The rows' places; how many lanes the recorded-clips row has (one per track, and one when there are none);
 * and how many columns a tap in the projectile row adds in (the highway's).
 */
export type TimelineLayout = { rows: Record<TimelineRow, RowSpan>; height: number; collapsed: ReadonlySet<TimelineRow>; clipLanes: number; shotColumns: number };

// Each track after the first adds a lane this tall to the recorded-clips row.
const CLIP_LANE_HEIGHT_PIXELS = 24;

export function layoutTimeline(
  collapsed: ReadonlySet<TimelineRow>, extraHeightPixels: number, { tracks = 0, shotColumns = PROJECTILE_COLUMNS }: { tracks?: number; shotColumns?: number } = {},
): TimelineLayout {
  const clipLanes = Math.max(1, tracks);
  const growing = TIMELINE_ROWS.filter(row => SHARE_OF_EXTRA_HEIGHT[row] && !collapsed.has(row));
  const totalShare = growing.reduce((sum, row) => sum + SHARE_OF_EXTRA_HEIGHT[row]!, 0);
  const rows = {} as Record<TimelineRow, RowSpan>;
  let top = 0;
  for (const row of TIMELINE_ROWS) {
    const extra = growing.includes(row) ? Math.round(extraHeightPixels * SHARE_OF_EXTRA_HEIGHT[row]! / totalShare) : 0;
    const lanes = row === "clip" ? (clipLanes - 1) * CLIP_LANE_HEIGHT_PIXELS : 0;
    const height = collapsed.has(row) ? COLLAPSED_ROW_HEIGHT_PIXELS : EXPANDED_ROW_HEIGHT_PIXELS[row] + lanes + extra;
    rows[row] = [top, height];
    top += height;
  }
  return { rows, height: top, collapsed, clipLanes, shotColumns };
}

/** A lane of the recorded-clips row: its top and height. Collapsed, the lanes share the thin strip. */
export function clipLaneSpan(layout: TimelineLayout, lane: number): RowSpan {
  const [top, height] = layout.rows.clip, each = height / layout.clipLanes;
  return [top + lane * each, each];
}

export type View = { t0: number; pps: number };
export const xOf = (v: View, t: number): number => (t - v.t0) * v.pps;
export const tOf = (v: View, x: number): number => x / v.pps + v.t0;

export const inRow = (layout: TimelineLayout, row: TimelineRow, y: number): boolean =>
  y >= layout.rows[row][0] && y < layout.rows[row][0] + layout.rows[row][1];

/** An event's marker: where it is, and how far left and right what is drawn for it reaches (a telegraph bar, a move's name). */
export type Marker = { i: number; x: number; y: number; left: number; right: number };

// The projectile row is the lane's width, top to bottom: a projectile sits as far down it as it starts
// across the lane - its own x, whatever columns it was placed in - with the middle of the lane in the
// middle. A tap adds in the nearest of the highway's columns (columnAtY).
const PROJECTILE_ROW_INSET_PIXELS = 7;

/** How far down an expanded projectile row a point across a lane this wide sits; one off the lane's side sits at its edge. */
function yOfX(layout: TimelineLayout, x: number, laneWidth: number): number {
  const [top, height] = layout.rows.shot, across = Math.min(1, Math.max(0, x / laneWidth + 0.5));
  return layout.collapsed.has("shot") ? top + height / 2 : top + PROJECTILE_ROW_INSET_PIXELS + across * (height - 2 * PROJECTILE_ROW_INSET_PIXELS);
}

/** The column whose line is nearest a point in the projectile row (the middle one when it is collapsed). */
export function columnAtY(layout: TimelineLayout, y: number): number {
  const [top, height] = layout.rows.shot, last = layout.shotColumns - 1;
  if (layout.collapsed.has("shot") || last < 1) return Math.floor(last / 2);
  const spacing = (height - 2 * PROJECTILE_ROW_INSET_PIXELS) / last;
  return Math.min(last, Math.max(0, Math.round((y - top - PROJECTILE_ROW_INSET_PIXELS) / spacing)));
}

/**
 * Where each event's marker is drawn: projectiles on five lines by where they start across the lane,
 * moves and spots in theirs - and markers that would land on one another (the same time and row)
 * fanned out sideways, so every one can be seen and clicked.
 */
export function markers(c: LoadedChart, tp: Tempo, view: View, layout: TimelineLayout): Marker[] {
  return placeMarkers(eventSpots(c, tp, layout), view);
}

/** An event's time, when a projectile appears (its time for anything else), and the height of its marker: what a marker's place needs from the chart. */
export type EventSpot = { i: number; t: number; spawn: number; y: number; projectile: boolean };

// How far a move's name can reach right of its marker, and how wide a marker is either side.
const MOVE_NAME_REACH_PIXELS = 160;
const MARKER_REACH_PIXELS = 8;

/**
 * Each event's time and row, in the chart's order - read from the chart once when it changes, so the
 * markers can follow the view (placeMarkers) without reading every event again.
 */
export function eventSpots(c: LoadedChart, tp: Tempo, layout: TimelineLayout): EventSpot[] {
  const out: EventSpot[] = [], width = laneOf(c).width, [moveTop, moveHeight] = layout.rows.move;
  c.events.forEach((e, i) => {
    const t = evTime(e, tp);
    if (!Number.isFinite(t)) return;
    const p = e.projectile, spawn = p ? t - (p.telegraph ?? 0.5) : t;
    out.push({ i, t, spawn, y: p ? yOfX(layout, +p.from?.x || 0, width) : moveTop + moveHeight / 2, projectile: !!p });
  });
  return out;
}

export function placeMarkers(spots: EventSpot[], view: View): Marker[] {
  const out: Marker[] = [], taken = new Map<string, number>(), step = 8;
  for (const { i, t, spawn, y, projectile } of spots) {
    const x0 = xOf(view, t), key = `${Math.round(x0 / 3)}:${y}`, n = taken.get(key) ?? 0, x = x0 + n * step;
    taken.set(key, n + 1);
    out.push({ i, x, y, left: Math.min(xOf(view, spawn), x) - MARKER_REACH_PIXELS, right: x + (projectile ? MARKER_REACH_PIXELS : MOVE_NAME_REACH_PIXELS) });
  }
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
