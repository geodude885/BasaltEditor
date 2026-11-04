// Editing several projectiles at once. Only what makes sense to share is offered: what they are, how
// fast, how early they show, who throws them, how high and how far away they start, and how they aim.
// Their times and where they are across the lane stay their own - one value would stack them on one
// spot - and are moved relatively instead (dragging, Mirror, moving columns).
import { round } from "./tempo";
import type { Projectile } from "./types";

/** The value every one of them has, or `MIXED` where they differ. */
export const MIXED = Symbol("mixed");
export function shared<I, T>(items: readonly I[], read: (item: I) => T): T | typeof MIXED {
  if (!items.length) return MIXED;
  const first = read(items[0]);
  return items.every(p => read(p) === first) ? first : MIXED;
}

/** How a projectile aims: at the player, straight down the lane from where it starts, or at some other point. */
export type AimKind = "player" | "straight" | "point";
export function aimOf(p: Projectile): AimKind {
  if (!p.to) return "player";
  return Math.abs((+p.to.x || 0) - (+p.from.x || 0)) < 0.001 ? "straight" : "point";
}

/** Aims a projectile at you or at a fixed point - never both: one drops the other's `to` or `offset`. */
export function setAimMode(p: Projectile, mode: "player" | "point"): void {
  if (mode === "player") { delete p.to; return; }
  delete p.offset;
  p.to ??= { x: 0, y: 1.3 };
}

/** Shifts an aim at you, rounded as the mod writes positions. A part that is 0 is left out, and so is an offset of nothing. */
export function setOffset(p: Projectile, changes: { x?: number; y?: number }): void {
  const wanted = { ...p.offset, ...changes }, offset: { x?: number; y?: number } = {};
  for (const axis of ["x", "y"] as const) {
    const value = round(+(wanted[axis] ?? 0) || 0, 2);
    if (value) offset[axis] = value;
  }
  if (offset.x == null && offset.y == null) delete p.offset;
  else p.offset = offset;
}

/** Aims a projectile at the player, or straight down the lane from where it starts (keeping its aim height). */
export function setAim(p: Projectile, aim: "player" | "straight"): void {
  if (aim === "player") { delete p.to; return; }
  delete p.offset;
  const y = p.to ? +p.to.y : 1.3;
  p.to = { x: +p.from.x || 0, y: Number.isFinite(y) ? y : 1.3 };
}
