// Picking out a stretch of the chart: the bar around a moment, and the projectiles in a span of time.
import { evTime } from "./chart";
import type { Tempo } from "./tempo";
import type { ChartEvent } from "./types";

/** How long a "bar" is where the chart has no tempo, so selecting a bar still does something. */
const BAR_WITHOUT_TEMPO_SECONDS = 2;

/** The bar (four beats) a moment falls in, as its start and end times. */
export function barAround(tp: Tempo, t: number): readonly [number, number] {
  if (!tp.ok) {
    const start = Math.floor(t / BAR_WITHOUT_TEMPO_SECONDS) * BAR_WITHOUT_TEMPO_SECONDS;
    return [start, start + BAR_WITHOUT_TEMPO_SECONDS];
  }
  const first = Math.floor(tp.beat(t) / 4) * 4;
  return [tp.seconds(first), tp.seconds(first + 4)];
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
