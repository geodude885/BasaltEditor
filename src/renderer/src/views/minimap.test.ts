import { describe, expect, it } from "vitest";
import { minimapTime, minimapY } from "./minimap";

describe("the minimap", () => {
  it("puts the start at the bottom and the end at the top", () => {
    expect(minimapY(200, 100, 0)).toBe(200);
    expect(minimapY(200, 100, 100)).toBe(0);
    expect(minimapTime(200, 100, minimapY(200, 100, 25))).toBe(25);
  });

  it("keeps a jump within the chart", () => {
    expect(minimapTime(200, 100, -10)).toBe(100);
    expect(minimapTime(200, 100, 260)).toBe(0);
  });
});
