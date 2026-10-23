import { describe, expect, it } from "vitest";
import { barsBefore, loopBetween } from "./practice";
import { Tempo } from "./tempo";

describe("practice tools", () => {
  it("steps back by bars of the chart's tempo", () => {
    expect(barsBefore(new Tempo(120), 10, 1)).toBeCloseTo(8);
    expect(barsBefore(new Tempo(60), 10, 2)).toBeCloseTo(2);
    expect(barsBefore(new Tempo(undefined), 10, 1)).toBe(8);
  });

  it("makes a loop from two points in either order", () => {
    expect(loopBetween(5, 2)).toEqual([2, 5]);
    expect(loopBetween(-1, 3)).toEqual([0, 3]);
    expect(loopBetween(4, 4.1)).toBeNull();
  });
});
