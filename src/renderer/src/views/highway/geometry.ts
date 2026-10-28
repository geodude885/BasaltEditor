// The highway editor's shape: columns side by side, time flowing down towards a hit line where the
// playhead is - later events above it, earlier ones below. Plain functions, so they can be tested.
import { evTime, laneOf } from "../../model/chart";
import { columnOfX, PROJECTILE_COLUMNS } from "../../model/columns";
import { BEATS_PER_BAR, type Tempo } from "../../model/tempo";
import type { LoadedChart } from "../../model/types";
import { normalise, type Box } from "../theme";

/** One column of the highway: a position across the lane (model/columns.ts), left to right. */
export type HighwayColumn = { column: number; label: string };

const PROJECTILE_LABELS = ["Far left", "Left", "Middle", "Right", "Far right"];

/** The columns the highway shows, left to right: the five are named, any other number numbered. */
export function highwayColumns(count = PROJECTILE_COLUMNS): HighwayColumn[] {
  return Array.from({ length: count }, (_, column): HighwayColumn =>
    ({ column, label: count === PROJECTILE_COLUMNS ? PROJECTILE_LABELS[column] : `Column ${column + 1}` }));
}

/** The highway on screen: its size, where the hit line is, and how many pixels a second takes. */
export type HighwayView = { w: number; h: number; hitY: number; pps: number; time: number };

export const HIT_LINE_FROM_TOP = 0.82;
export const DEFAULT_HIGHWAY_PPS = 140;
export const SMALLEST_HIGHWAY_PPS = 40;
export const LARGEST_HIGHWAY_PPS = 600;

export const yOfTime = (v: HighwayView, t: number): number => v.hitY - (t - v.time) * v.pps;
export const timeOfY = (v: HighwayView, y: number): number => v.time + (v.hitY - y) / v.pps;

/** The left edge and width of a column, in pixels. */
export function columnSpan(v: HighwayView, count: number, index: number): [x: number, width: number] {
  const width = v.w / count;
  return [index * width, width];
}

/** The column under a point across the highway. */
export const columnIndexAtX = (v: HighwayView, count: number, x: number): number =>
  Math.min(count - 1, Math.max(0, Math.floor(x / (v.w / count))));

export type Tile = { i: number; column: number; t: number; x: number; y: number; w: number; h: number };

const TILE_HEIGHT_PIXELS = 14;
const TILE_SIDE_INSET = 0.14;

/** The chart's events as tiles on the highway - only those near enough to be seen. */
export function tiles(c: LoadedChart, tp: Tempo, v: HighwayView, columns: HighwayColumn[]): Tile[] {
  const out: Tile[] = [], width = laneOf(c).width, count = columns.length;
  const earliest = timeOfY(v, v.h + TILE_HEIGHT_PIXELS), latest = timeOfY(v, -TILE_HEIGHT_PIXELS);
  c.events.forEach((e, i) => {
    if (!e.projectile) return;
    const t = evTime(e, tp);
    if (!Number.isFinite(t) || t < earliest || t > latest) return;
    const index = columns.findIndex(col => col.column === columnOfX(+e.projectile!.from?.x || 0, width, count));
    if (index < 0) return;
    const [cx, cw] = columnSpan(v, count, index), inset = cw * TILE_SIDE_INSET;
    out.push({ i, column: index, t, x: cx + inset, y: yOfTime(v, t) - TILE_HEIGHT_PIXELS / 2, w: cw - 2 * inset, h: TILE_HEIGHT_PIXELS });
  });
  return out;
}

const TOUCH_SLOP_PIXELS = 8;

/** The tiles under a point, nearest the point first; a finger gets a little room around each. */
export function tilesAt(placed: Tile[], x: number, y: number): number[] {
  return placed
    .filter(t => x >= t.x - TOUCH_SLOP_PIXELS && x <= t.x + t.w + TOUCH_SLOP_PIXELS && y >= t.y - TOUCH_SLOP_PIXELS && y <= t.y + t.h + TOUCH_SLOP_PIXELS)
    .sort((a, b) => Math.abs(a.y + a.h / 2 - y) - Math.abs(b.y + b.h / 2 - y))
    .map(t => t.i);
}

/** The tiles a box touches. */
export function tilesInBox(placed: Tile[], box: Box): number[] {
  const b = normalise(box);
  return placed.filter(t => t.x < b.x1 && t.x + t.w > b.x0 && t.y < b.y1 && t.y + t.h > b.y0).map(t => t.i);
}

/** The beats (and which start bars) between two times, for the grid lines. Empty without a tempo. */
export function beatsBetween(tp: Tempo, from: number, to: number): { t: number; bar: boolean }[] {
  if (!tp.ok || to <= from) return [];
  const out: { t: number; bar: boolean }[] = [];
  for (let b = Math.ceil(tp.beat(Math.max(0, from))); out.length < 2000; b++) {
    const t = tp.seconds(b);
    if (t > to) break;
    out.push({ t, bar: b % BEATS_PER_BAR === 0 });
  }
  return out;
}
