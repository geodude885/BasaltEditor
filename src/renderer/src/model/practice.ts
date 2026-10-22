// The practice tools' sums: stepping back by bars, and loops.
import type { Tempo } from "./tempo";

/** Seconds a bar lasts where there is no tempo, so rewinding still does something. */
const BAR_WITHOUT_TEMPO_SECONDS = 2;

/** The time `bars` bars (four beats each) before `t` - or after, for a negative count. */
export function barsBefore(tp: Tempo, t: number, bars: number): number {
  return tp.ok ? tp.seconds(tp.beat(t) - 4 * bars) : t - bars * BAR_WITHOUT_TEMPO_SECONDS;
}

/** A loop from two points set in either order; null if they are too close to loop. */
export function loopBetween(a: number, b: number): readonly [number, number] | null {
  const from = Math.max(0, Math.min(a, b)), to = Math.max(a, b);
  return to - from >= 0.25 ? [from, to] : null;
}
