// The lane seen from above: lane metres (x across, z away from you) to canvas pixels and back.
import type { Lane } from "../../model/chart";
import { SIZES } from "../../model/constants";
import type { Projectile } from "../../model/types";

export type LaneMap = {
  toPx(x: number, z: number): [number, number];
  toLane(px: number, py: number): [number, number];
  /** Pixels a metre. */
  scale: number;
};

const MARGIN = 26;

export function laneMap(w: number, h: number, lane: Lane): LaneMap {
  const scale = Math.min((w - MARGIN * 2) / (lane.width + 3), (h - MARGIN * 2) / (lane.length + 2));
  const cx = w / 2, bottom = h - MARGIN - scale * 0.9;
  return {
    toPx: (x, z) => [cx + x * scale, bottom - z * scale],
    toLane: (px, py) => [(px - cx) / scale, (bottom - py) / scale],
    scale,
  };
}

/** A structure's footprint in pixels, to scale but at least a few pixels; `grow` pads it. */
export function footprint(structure: string, scale: number, grow = 0): { hw: number; hh: number } {
  const size = SIZES[structure] ?? { across: 0.8, along: 0.8 };
  return { hw: Math.max(4, size.across * scale / 2) + grow, hh: Math.max(3, size.along * scale / 2) + grow };
}

export const isRound = (structure: string): boolean => structure === "Disc" || structure === "Ball" || structure === "BoulderBall";

/** Where a projectile starts, in pixels. */
export const originPx = (s: Projectile, map: LaneMap): [number, number] => map.toPx(+s.from?.x || 0, +s.from?.z || 0);

/** Whether a point is on a projectile's footprint where it starts (a few pixels of slack). */
export function onFootprint(s: Projectile, map: LaneMap, px: number, py: number): boolean {
  const [fx, fy] = originPx(s, map), { hw, hh } = footprint(s.structure, map.scale, 4);
  return Math.abs(px - fx) <= hw && Math.abs(py - fy) <= hh;
}
