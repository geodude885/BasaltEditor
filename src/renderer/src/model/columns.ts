// The positions across the lane that the timeline's projectile row and the highway editor share: a
// projectile sits in the column nearest where it starts across the lane, and one added in a column
// starts there. Five, an odd number, so the middle of the lane is a column.
import { laneOf } from "./chart";
import { round } from "./tempo";
import type { LoadedChart, Projectile } from "./types";

export const PROJECTILE_COLUMNS = 5;

/** The column nearest a point across a lane this wide (x = 0 is the middle). */
export function columnOfX(x: number, laneWidth: number): number {
  const last = PROJECTILE_COLUMNS - 1;
  return Math.min(last, Math.max(0, Math.round(((+x || 0) / laneWidth + 0.5) * last)));
}

/** Where a column is across a lane this wide. */
export function xOfColumn(column: number, laneWidth: number): number {
  return round((column / (PROJECTILE_COLUMNS - 1) - 0.5) * laneWidth, 2);
}

/**
 * A projectile as the example chart throws them: a disc from the far end of the lane, about chest
 * high, flying straight down the lane (not at the player) from `x` across it.
 */
export function straightProjectile(c: LoadedChart, x: number, by: string): Projectile {
  const length = laneOf(c).length;
  return {
    structure: "Disc",
    from: { x, y: 1.4, z: round(Math.max(0.5, Math.min(10, length - 2)), 1) },
    to: { x, y: 1.3 },
    speed: 11, telegraph: 0.8, by,
  };
}

/** Moves a projectile to a column, keeping its aim the same way off its start - straight stays straight. */
export function moveToColumn(p: Projectile, column: number, laneWidth: number): void {
  const x = xOfColumn(column, laneWidth), dx = x - (+p.from.x || 0);
  p.from.x = x;
  if (p.to && p.to !== "player") p.to.x = round((+p.to.x || 0) + dx, 2);
}
