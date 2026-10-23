import { describe, expect, it } from "vitest";
import { barAround, projectilesBetween } from "./ranges";
import { Tempo } from "./tempo";
import type { ChartEvent } from "./types";

const shot = (t: number): ChartEvent => ({ t, projectile: { structure: "Disc", from: { x: 0, y: 1.4, z: 10 }, speed: 11 } });

describe("ranges", () => {
  it("finds the bar a moment falls in", () => {
    const tp = new Tempo(120); // a bar is 2 s
    expect(barAround(tp, 0)).toEqual([0, 2]);
    expect(barAround(tp, 3.9)).toEqual([2, 4]);
    expect(barAround(tp, 4)).toEqual([4, 6]);
    expect(barAround(new Tempo(undefined), 5)).toEqual([4, 6]);
  });

  it("picks the projectiles in a span, its start but not its end", () => {
    const events: ChartEvent[] = [shot(1), shot(2), { t: 2.5, move: "Straight" }, shot(3.99), shot(4)];
    expect(projectilesBetween(events, new Tempo(undefined), 2, 4)).toEqual([1, 3]);
    expect(projectilesBetween(events, new Tempo(undefined), 0, Infinity)).toEqual([0, 1, 3, 4]);
  });
});
