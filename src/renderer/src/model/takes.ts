// Recording by tapping along: the pure parts - what a take replaces, and which taps are doubles.
import { evTime } from "./chart";
import type { Tempo } from "./tempo";
import type { ChartEvent } from "./types";

/** How far either side of a take's first and last taps "replace" still reaches, in seconds. */
export const REPLACE_MARGIN_SECONDS = 0.05;

/**
 * The events left after a take in replace mode: the take's own, and everything but the projectiles
 * it was recorded over.
 */
export function afterReplacing(events: ChartEvent[], take: ReadonlySet<ChartEvent>, from: number, to: number, tp: Tempo): ChartEvent[] {
  return events.filter(e => {
    if (take.has(e) || !e.projectile) return true;
    const t = evTime(e, tp);
    return !(t >= from - REPLACE_MARGIN_SECONDS && t <= to + REPLACE_MARGIN_SECONDS);
  });
}

/** Two taps that snap to the same time in the same column are one. */
export const sameTap = (a: { t: number; column: number }, b: { t: number; column: number }): boolean =>
  a.column === b.column && Math.abs(a.t - b.t) < 0.001;
