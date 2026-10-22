import { describe, expect, it } from "vitest";
import { afterReplacing, sameTap } from "./takes";
import { Tempo } from "./tempo";
import type { ChartEvent } from "./types";

const shot = (t: number): ChartEvent => ({ t, projectile: { structure: "Disc", from: { x: 0, y: 1.4, z: 10 }, speed: 11 } });

describe("takes", () => {
  it("replaces the projectiles a take was recorded over, and nothing else", () => {
    const before = shot(1), inside = shot(3), after = shot(8), move: ChartEvent = { t: 3, move: "Straight" }, recorded = shot(3.5);
    const left = afterReplacing([before, inside, after, move, recorded], new Set([recorded]), 2, 5, new Tempo(undefined));
    expect(left).toEqual([before, after, move, recorded]);
  });

  it("counts two taps on the same snapped spot as one", () => {
    expect(sameTap({ t: 2, column: 1 }, { t: 2, column: 1 })).toBe(true);
    expect(sameTap({ t: 2, column: 1 }, { t: 2, column: 2 })).toBe(false);
    expect(sameTap({ t: 2, column: 1 }, { t: 2.25, column: 1 })).toBe(false);
  });
});
