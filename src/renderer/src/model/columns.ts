// The positions across the lane that the timeline's projectile row and the highway editor share: a
// projectile sits in the column nearest where it starts across the lane, and one added in a column
// starts there. The timeline always draws five, an odd number, so the middle of the lane is a column; the
// highway shows as many as the editor is set to (HIGHWAY_COLUMNS_RANGE), five to start with.
import { laneOf } from "./chart";
import { round } from "./tempo";
import type { LoadedChart, Projectile } from "./types";

export const PROJECTILE_COLUMNS = 5;
/** How few and how many columns the highway can have: up to one per number and letter key. */
export const HIGHWAY_COLUMNS_RANGE = [1, 36] as const;

/** The column nearest a point across a lane this wide (x = 0 is the middle), out of `count` columns. */
export function columnOfX(x: number, laneWidth: number, count = PROJECTILE_COLUMNS): number {
  const last = count - 1;
  return Math.min(last, Math.max(0, Math.round(((+x || 0) / laneWidth + 0.5) * last)));
}

/** Where a column is across a lane this wide, out of `count` columns. One column is the middle. */
export function xOfColumn(column: number, laneWidth: number, count = PROJECTILE_COLUMNS): number {
  return count < 2 ? 0 : round((column / (count - 1) - 0.5) * laneWidth, 2);
}

/**
 * A projectile as the example chart throws them: a disc from the far end of the lane, about chest
 * high, flying straight down the lane (not at the player) from `x` across it.
 */
export function straightProjectile(c: LoadedChart, x: number): Projectile {
  const length = laneOf(c).length;
  return {
    structure: "Disc",
    from: { x, y: 1.4, z: round(Math.max(0.5, Math.min(10, length - 2)), 1) },
    to: { x, y: 1.3 },
    speed: 11, telegraph: 0.8,
  };
}

/** What new projectiles in a column are like. */
export type ProjectileTemplate = Projectile;

/** A projectile as a template for new ones: a copy. */
export const templateOf = (p: Projectile): ProjectileTemplate => JSON.parse(JSON.stringify(p)) as Projectile;

/** A template that is the default projectile (or this one) as a given structure. */
export function templateAs(c: LoadedChart, template: ProjectileTemplate | null, structure: Projectile["structure"]): ProjectileTemplate {
  return { ...(template ?? straightProjectile(c, 0)), structure };
}

/**
 * A new projectile starting at `x` across the lane: like the template, aimed as far across from its start as
 * the template is, and no further down the lane than a projectile may start - or, without one, straight down the lane.
 */
export function projectileAt(c: LoadedChart, x: number, template: ProjectileTemplate | null): Projectile {
  if (!template) return straightProjectile(c, x);
  const p = templateOf(template), dx = x - (+p.from?.x || 0);
  p.from = { ...p.from, x, z: round(Math.min(+p.from?.z || 0, laneOf(c).length + 6), 1) };
  if (p.to) p.to = { ...p.to, x: round((+p.to.x || 0) + dx, 2) };
  return p;
}

/** Moves a projectile to a column, keeping its aim the same way off its start - straight stays straight. */
export function moveToColumn(p: Projectile, column: number, laneWidth: number, count = PROJECTILE_COLUMNS): void {
  const x = xOfColumn(column, laneWidth, count), dx = x - (+p.from.x || 0);
  p.from.x = x;
  if (p.to) p.to.x = round((+p.to.x || 0) + dx, 2);
}
