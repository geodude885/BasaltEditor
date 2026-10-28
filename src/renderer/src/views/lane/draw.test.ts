import { describe, expect, it } from "vitest";
import { straightProjectile } from "../../model/columns";
import { Tempo } from "../../model/tempo";
import type { LoadedChart } from "../../model/types";
import { laneShots } from "./draw";

describe("the lane's projectiles", () => {
  it("are in the order they appear, with the longest any is on the lane", () => {
    const c = { events: [], lane: { length: 12, width: 3 } } as unknown as LoadedChart;
    c.events.push({ t: 5, projectile: { ...straightProjectile(c, 0, "a"), telegraph: 0.5 } });
    c.events.push({ t: 2, move: "Straight" });
    c.events.push({ t: 3, projectile: { ...straightProjectile(c, 1, "a"), telegraph: 2 } });
    const { shots, longest } = laneShots(c, new Tempo(undefined));
    expect(shots.map(s => [s.i, s.spawn])).toEqual([[2, 1], [0, 4.5]]);
    expect(longest).toBeCloseTo(Math.max(...shots.map(s => s.end - s.spawn)));
    expect(shots[0].end).toBeGreaterThan(3);
  });
});
