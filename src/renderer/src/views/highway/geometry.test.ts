import { describe, expect, it } from "vitest";
import { straightProjectile, xOfColumn } from "../../model/columns";
import { Tempo } from "../../model/tempo";
import type { LoadedChart } from "../../model/types";
import { beatsBetween, columnIndexAtX, highwayColumns, highwayXOf, tiles, tilesAt, tilesInBox, timeOfY, yOfTime, type HighwayView } from "./geometry";

const view: HighwayView = { w: 500, h: 400, hitY: 320, pps: 100, time: 10 };
const chart = (): LoadedChart => {
  const c = { events: [], lane: { length: 12, width: 3 } } as unknown as LoadedChart;
  c.events.push({ t: 10, projectile: straightProjectile(c, xOfColumn(0, 3)) });
  c.events.push({ t: 11, projectile: straightProjectile(c, xOfColumn(4, 3)) });
  c.events.push({ t: 40, projectile: straightProjectile(c, 0) });
  return c;
};

describe("the highway", () => {
  it("puts the playhead on the hit line and later times above it", () => {
    expect(yOfTime(view, 10)).toBe(320);
    expect(yOfTime(view, 11)).toBe(220);
    expect(timeOfY(view, yOfTime(view, 12.5))).toBeCloseTo(12.5);
  });

  it("has one column per position across the lane", () => {
    const columns = highwayColumns();
    expect(columns.map(c => c.column)).toEqual([0, 1, 2, 3, 4]);
    expect(columnIndexAtX(view, 5, 0)).toBe(0);
    expect(columnIndexAtX(view, 5, 499)).toBe(4);
  });

  it("can have more columns, numbered, with a projectile in the one nearest where it starts", () => {
    const columns = highwayColumns(9);
    expect(columns.map(c => c.label)).toEqual(Array.from({ length: 9 }, (_, i) => `Column ${i + 1}`));
    const placed = tiles(chart(), new Tempo(undefined), { ...view, time: 10 }, columns);
    expect(placed.map(t => t.column)).toEqual([0, 8]);
  });

  it("draws each projectile where it starts across the lane: in its column's middle, or between columns", () => {
    // A 500 px highway of 5 columns over a 3 m lane: column middles at 50, 150 ... 450.
    expect([-1.5, -0.75, 0, 0.75, 1.5].map(x => highwayXOf(view, 5, x, 3))).toEqual([50, 150, 250, 350, 450]);
    expect(highwayXOf(view, 5, -1, 3)).toBeCloseTo(116.67, 1);
    expect(highwayXOf(view, 5, 9, 3)).toBe(450);
    expect(highwayXOf(view, 1, 1, 3)).toBe(250);
    const c = chart();
    c.events.push({ t: 10, projectile: straightProjectile(c, -1) });
    const between = tiles(c, new Tempo(undefined), view, highwayColumns()).find(t => t.i === 3)!;
    expect(between.x + between.w / 2).toBeCloseTo(116.67, 1);
    expect(between.column).toBe(1);
  });

  it("places each projectile in its column at its time, leaving out those far off screen", () => {
    const placed = tiles(chart(), new Tempo(undefined), view, highwayColumns());
    expect(placed.map(t => [t.i, t.column])).toEqual([[0, 0], [1, 4]]);
    expect(placed[1].y + placed[1].h / 2).toBeCloseTo(220);
  });

  it("finds tiles under a finger and in a box", () => {
    const placed = tiles(chart(), new Tempo(undefined), view, highwayColumns());
    expect(tilesAt(placed, 50, 320)).toEqual([0]);
    expect(tilesAt(placed, 250, 320)).toEqual([]);
    expect(tilesInBox(placed, { x0: 0, y0: 0, x1: 500, y1: 400 }).sort()).toEqual([0, 1]);
  });

  it("lists beats and bars between two times", () => {
    const beats = beatsBetween(new Tempo(120), 0, 2.1);
    expect(beats.map(b => b.t)).toEqual([0, 0.5, 1, 1.5, 2]);
    expect(beats.map(b => b.bar)).toEqual([true, false, false, false, true]);
    expect(beatsBetween(new Tempo(undefined), 0, 10)).toEqual([]);
  });
});
