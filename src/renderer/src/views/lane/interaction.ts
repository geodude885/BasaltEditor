// What a press on the lane means, and where a drag puts things - plain functions the component applies.
import { evTime, laneOf, type Point } from "../../model/chart";
import { round, type Tempo } from "../../model/tempo";
import type { LoadedChart } from "../../model/types";
import { normalise, type Box } from "../theme";
import { onFootprint, originPx, type LaneMap } from "./geometry";

const GRAB_ORIGIN_PIXELS = 14;
const GRAB_AIM_PIXELS = 12;
const PROJECTILE_START_NEAREST_METRES = 0.5;
const DRAG_PAST_THE_SIDES_METRES = 2;

export type ProjectilePoint = "from" | "to";

export type LanePress =
  | { kind: "drag-projectile-point"; index: number; point: ProjectilePoint }
  | { kind: "select-projectile"; underPointer: number[] }
  | { kind: "add-projectile"; at: Point }
  | { kind: "box-select" };

export function whatALanePressHits(
  chart: LoadedChart, tempo: Tempo, playheadSeconds: number, selection: Iterable<number>, map: LaneMap,
  px: number, py: number, wantsToAddProjectile: boolean,
): LanePress {
  for (const index of selection) {
    const s = chart.events[index]?.projectile;
    if (!s) continue;
    const [fx, fy] = originPx(s, map);
    if (Math.hypot(px - fx, py - fy) < GRAB_ORIGIN_PIXELS) return { kind: "drag-projectile-point", index, point: "from" };
    if (s.to) {
      const [tx, ty] = map.toPx(+s.to.x || 0, 0);
      if (Math.hypot(px - tx, py - ty) < GRAB_AIM_PIXELS) return { kind: "drag-projectile-point", index, point: "to" };
    }
  }

  // Nearest in time to the playhead first, so clicking the same spot again can step through a stack.
  const underPointer = chart.events
    .map((e, i) => [e, i] as const)
    .filter(([e]) => e.projectile?.from && onFootprint(e.projectile, map, px, py))
    .sort((a, b) => Math.abs(evTime(a[0], tempo) - playheadSeconds) - Math.abs(evTime(b[0], tempo) - playheadSeconds))
    .map(([, i]) => i);
  if (underPointer.length) return { kind: "select-projectile", underPointer };

  if (wantsToAddProjectile) {
    const [x, z] = map.toLane(px, py);
    return { kind: "add-projectile", at: { x: round(x, 1), z: round(Math.min(laneOf(chart).length, Math.max(PROJECTILE_START_NEAREST_METRES, z)), 1) } };
  }
  return { kind: "box-select" };
}

export function projectilesStartingInBox(chart: LoadedChart, map: LaneMap, box: Box): number[] {
  const b = normalise(box), inside: number[] = [];
  chart.events.forEach((e, i) => {
    if (!e.projectile?.from) return;
    const [fx, fy] = originPx(e.projectile, map);
    if (fx >= b.x0 && fx <= b.x1 && fy >= b.y0 && fy <= b.y1) inside.push(i);
  });
  return inside;
}

// Where a dragged point lands, in lane metres: a start stays on the lane, an aim may go past its sides.
export function moveProjectilePoint(chart: LoadedChart, map: LaneMap, index: number, point: ProjectilePoint, px: number, py: number): void {
  const s = chart.events[index]?.projectile, lane = laneOf(chart);
  if (!s) return;
  const [x, z] = map.toLane(px, py), sideLimit = lane.width / 2 + DRAG_PAST_THE_SIDES_METRES;
  const across = round(Math.max(-sideLimit, Math.min(sideLimit, x)), 1);
  if (point === "from") { s.from.x = across; s.from.z = round(Math.max(PROJECTILE_START_NEAREST_METRES, Math.min(lane.length, z)), 1); }
  else if (s.to) s.to.x = across;
}
