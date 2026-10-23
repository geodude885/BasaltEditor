// The practice tools' sums: stepping back by bars, and loops.
import { BAR_WITHOUT_TEMPO_SECONDS, BEATS_PER_BAR, type Tempo } from "./tempo";

/** The time `bars` bars before `t` - or after, for a negative count. */
export function barsBefore(tp: Tempo, t: number, bars: number): number {
  return tp.ok ? tp.seconds(tp.beat(t) - BEATS_PER_BAR * bars) : t - bars * BAR_WITHOUT_TEMPO_SECONDS;
}

/** A loop from two points set in either order; null if they are too close to loop. */
export function loopBetween(a: number, b: number): readonly [number, number] | null {
  const from = Math.max(0, Math.min(a, b)), to = Math.max(a, b);
  return to - from >= 0.25 ? [from, to] : null;
}
