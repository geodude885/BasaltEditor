// The timeline's rows, its time-to-pixel mapping, and where each event's marker sits.
import { evTime, laneOf } from "../../model/chart";
import type { Tempo } from "../../model/tempo";
import type { LoadedChart } from "../../model/types";

/** Each row's top and height, in pixels. */
export const ROWS = { ruler: [0, 22], wave: [22, 58], phase: [80, 22], shot: [102, 46], move: [148, 34], clip: [182, 30] } as const;
export const HEIGHT = 230;

export type View = { t0: number; pps: number };
export const xOf = (v: View, t: number): number => (t - v.t0) * v.pps;
export const tOf = (v: View, x: number): number => x / v.pps + v.t0;

export const inRow = (row: keyof typeof ROWS, y: number): boolean => y >= ROWS[row][0] && y < ROWS[row][0] + ROWS[row][1];

export type Marker = { i: number; x: number; y: number };

/**
 * Where each event's marker is drawn: projectiles in four rows by where they start across the lane,
 * moves and spots in theirs - and markers that would land on one another (the same time and row)
 * fanned out sideways, so every one can be seen and clicked.
 */
export function markers(c: LoadedChart, tp: Tempo, view: View): Marker[] {
  const out: Marker[] = [], taken = new Map<string, number>(), lanes = 4, step = 8, width = laneOf(c).width;
  c.events.forEach((e, i) => {
    const t = evTime(e, tp);
    if (!Number.isFinite(t)) return;
    const x = xOf(view, t);
    let y: number;
    if (e.projectile) {
      const row = Math.min(lanes - 1, Math.max(0, Math.round(((+e.projectile.from?.x || 0) / width + 0.5) * (lanes - 1))));
      y = ROWS.shot[0] + 7 + row * ((ROWS.shot[1] - 14) / (lanes - 1));
    } else {
      y = ROWS.move[0] + ROWS.move[1] / 2;
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
