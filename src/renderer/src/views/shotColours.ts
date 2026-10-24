// Colouring projectiles by what they are (View > Projectile colours): by structure, by whether they are
// thrown grounded, or both - grounded ones striped over their structure's colour. The lane, timeline
// and highway all paint them from here, and the legend lists the same.
import { isGrounded } from "../model/chart";
import { STRUCTURES } from "../model/constants";
import type { LoadedChart, Projectile, Structure } from "../model/types";
import { alpha, type Theme } from "./theme";

export type ShotColouring = "plain" | "structure" | "grounded" | "both";

export const SHOT_COLOURINGS: [ShotColouring, string][] = [
  ["plain", "One colour"], ["structure", "By structure"], ["grounded", "By grounded"], ["both", "By structure and grounded"],
];

const STRUCTURE_COLOUR: Record<Structure, keyof Theme> = {
  Disc: "shotDisc", Ball: "shotBall", Pillar: "shotPillar", Wall: "shotWall", RockCube: "shotRockCube",
  BoulderBall: "shotBoulderBall", SmallRock: "shotSmallRock", LargeRock: "shotLargeRock",
};

/** The theme colour a structure is painted in, as its CSS variable says - "shotRockCube" is --shot-rock-cube. */
export const structureColourVariable = (structure: Structure): string =>
  "--" + STRUCTURE_COLOUR[structure].replace(/[A-Z]/g, c => "-" + c.toLowerCase());

/** How to paint a projectile: a colour (null: the view's own, as before) and whether to stripe it as grounded. */
export type ShotPaint = { colour: string | null; striped: boolean };

export function shotPaint(p: Projectile | undefined, colouring: ShotColouring, t: Theme): ShotPaint {
  if (!p || colouring === "plain") return { colour: null, striped: false };
  const grounded = isGrounded(p);
  if (colouring === "grounded") return { colour: grounded ? t.shotGrounded : t.shotAirborne, striped: false };
  const key = STRUCTURE_COLOUR[p.structure];
  return { colour: key ? t[key] : t.text, striped: colouring === "both" && grounded };
}

const STRIPE_GAP_PIXELS = 4;

/**
 * Stripes across the current path, inside it - drawn after filling it. `box` is roughly where the path is.
 * The stripes are a path of their own, so the current one is still the shape's after, for an outline.
 */
export function stripePath(ctx: CanvasRenderingContext2D, t: Theme, box: { x: number; y: number; w: number; h: number }): void {
  const stripes = new Path2D();
  for (let d = -box.h; d < box.w + box.h; d += STRIPE_GAP_PIXELS) {
    stripes.moveTo(box.x + d, box.y + box.h);
    stripes.lineTo(box.x + d + box.h, box.y);
  }
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = alpha(t.floor, 0.8); ctx.lineWidth = 1.5;
  ctx.stroke(stripes);
  ctx.restore();
}

export type LegendEntry = { label: string; colourVariable: string; striped: boolean };

/** What the legend shows for a colouring: the structures this chart throws, and the grounded ones. */
export function shotLegend(chart: LoadedChart, colouring: ShotColouring): LegendEntry[] {
  if (colouring === "plain") return [];
  const shots = chart.events.flatMap(e => e.projectile ? [e.projectile] : []);
  if (colouring === "grounded") {
    return [
      { label: "grounded", colourVariable: "--shot-grounded", striped: false },
      { label: "in the air", colourVariable: "--shot-airborne", striped: false },
    ];
  }
  const used = STRUCTURES.filter(s => shots.some(p => p.structure === s));
  const entries: LegendEntry[] = used.map(s => ({ label: s, colourVariable: structureColourVariable(s), striped: false }));
  if (colouring === "both" && shots.some(isGrounded)) entries.push({ label: "grounded", colourVariable: "--text-dim", striped: true });
  return entries;
}
