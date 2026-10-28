import { describe, expect, it } from "vitest";
import { columnOfX, HIGHWAY_COLUMNS_RANGE, moveToColumn, PROJECTILE_COLUMNS, straightProjectile, xOfColumn } from "./columns";
import type { LoadedChart } from "./types";

describe("projectile columns", () => {
  it("puts the middle of the lane in the middle column and the edges in the outer ones", () => {
    expect(columnOfX(0, 3)).toBe(2);
    expect(columnOfX(-1.5, 3)).toBe(0);
    expect(columnOfX(1.5, 3)).toBe(PROJECTILE_COLUMNS - 1);
    expect(columnOfX(9, 3)).toBe(PROJECTILE_COLUMNS - 1);
  });

  it("goes back and forth between columns and positions", () => {
    for (let c = 0; c < PROJECTILE_COLUMNS; c++) expect(columnOfX(xOfColumn(c, 3), 3)).toBe(c);
    expect(xOfColumn(0, 3)).toBe(-1.5);
    expect(xOfColumn(2, 3)).toBe(0);
  });

  it("spreads any number of columns across the lane, one being the middle", () => {
    for (const count of [2, 8, HIGHWAY_COLUMNS_RANGE[1]]) {
      for (let c = 0; c < count; c++) expect(columnOfX(xOfColumn(c, 3, count), 3, count)).toBe(c);
      expect([xOfColumn(0, 3, count), xOfColumn(count - 1, 3, count)]).toEqual([-1.5, 1.5]);
    }
    expect(xOfColumn(0, 3, 1)).toBe(0);
    expect(columnOfX(1.2, 3, 1)).toBe(0);
  });

  it("makes a projectile that flies straight down the lane", () => {
    const chart: LoadedChart = { events: [], lane: { length: 12, width: 3 } } as LoadedChart;
    const p = straightProjectile(chart, 0.75, "gunner");
    expect(p.from).toEqual({ x: 0.75, y: 1.4, z: 10 });
    expect(p.to).toEqual({ x: 0.75, y: 1.3 });
    expect(p.by).toBe("gunner");
  });

  it("moves a projectile to another column, keeping its aim alongside", () => {
    const chart: LoadedChart = { events: [], lane: { length: 12, width: 3 } } as LoadedChart;
    const p = straightProjectile(chart, 0, "gunner");
    moveToColumn(p, 0, 3);
    expect(p.from.x).toBe(-1.5);
    expect(p.to).toEqual({ x: -1.5, y: 1.3 });
    const atPlayer = { ...straightProjectile(chart, 0, "gunner"), to: "player" as const };
    moveToColumn(atPlayer, 4, 3);
    expect(atPlayer.from.x).toBe(1.5);
    expect(atPlayer.to).toBe("player");
  });
});
