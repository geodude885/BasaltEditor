// Picking out a stretch of the chart: the bar around a moment, and the projectiles in a span of time.
import { evTime } from "./chart";
import { BAR_WITHOUT_TEMPO_SECONDS, BEATS_PER_BAR, type Tempo } from "./tempo";
import type { ChartEvent } from "./types";

/** The bar a moment falls in, as its start and end times. */
export function barAround(tp: Tempo, t: number): readonly [number, number] {
  if (!tp.ok) {
    const start = Math.floor(t / BAR_WITHOUT_TEMPO_SECONDS) * BAR_WITHOUT_TEMPO_SECONDS;
    return [start, start + BAR_WITHOUT_TEMPO_SECONDS];
  }
  const first = Math.floor(tp.beat(t) / BEATS_PER_BAR) * BEATS_PER_BAR;
  return [tp.seconds(first), tp.seconds(first + BEATS_PER_BAR)];
}

/** The indices of the projectiles from `from` up to (not including) `to`. */
export function projectilesBetween(events: ChartEvent[], tp: Tempo, from: number, to: number): number[] {
  const out: number[] = [];
  events.forEach((e, i) => {
    if (!e.projectile) return;
    const t = evTime(e, tp);
    if (t >= from - 0.0005 && t < to - 0.0005) out.push(i);
  });
  return out;
}
