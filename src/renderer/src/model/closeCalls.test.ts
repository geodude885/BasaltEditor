import { describe, expect, it } from "vitest";
import { closeCallKey, closeCalls } from "./closeCalls";
import { Tempo } from "./tempo";
import type { ChartEvent, LoadedChart } from "./types";

const tempo = new Tempo(undefined);
const disc = (t: number, x: number, z = 10, extra: Record<string, unknown> = {}): ChartEvent =>
  ({ t, projectile: { structure: "Disc", from: { x, y: 0, z }, speed: 10, telegraph: 0.8, ...extra } }) as ChartEvent;
const chart = (...events: ChartEvent[]) => ({ events }) as LoadedChart;

describe("close calls", () => {
  it("are two structures waiting on top of each other", () => {
    const calls = closeCalls(chart(disc(2, 0), disc(2.2, 0.3)), tempo);
    expect(calls).toEqual([{ a: 0, b: 1, at: expect.closeTo(1.4, 2), kind: "waiting" }]);
  });

  it("leave alone ones waiting side by side, or in the lane at different times", () => {
    expect(closeCalls(chart(disc(2, -1), disc(2, 1)), tempo)).toEqual([]);
    expect(closeCalls(chart(disc(2, 0), disc(5, 0)), tempo)).toEqual([]);
  });

  it("are one launched and not yet out of the way of the next, waiting where it started", () => {
    // The first leaves at 2 s at 10 m/s; the second appears in its place 0.75 s before 2.1 s, before the first has gone a disc's length.
    const calls = closeCalls(chart(disc(2, 0), disc(2.1, 0, 10, { telegraph: 0.05 })), tempo);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ a: 0, b: 1, kind: "in-the-way" });
    expect(closeCalls(chart(disc(2, 0), disc(2.5, 0, 10, { telegraph: 0.05 })), tempo)).toEqual([]);
  });

  it("don't count two on their way crossing", () => {
    const crossing = chart(
      disc(2, -1.2, 10, { to: { x: 1.2, y: 1 }, telegraph: 0.1 }),
      disc(2, 1.2, 10, { to: { x: -1.2, y: 1 }, telegraph: 0.1 }),
    );
    expect(closeCalls(crossing, tempo)).toEqual([]);
  });

  it("are remembered by both projectiles as they are, so changing either is a new one", () => {
    const c = chart(disc(2, 0), disc(2.2, 0.3)), [call] = closeCalls(c, tempo), key = closeCallKey(c, call);
    expect(closeCallKey(chart(disc(2, 0), disc(2.2, 0.3)), call)).toBe(key);
    expect(closeCallKey(chart(disc(2, 0), disc(2.2, 0.35)), call)).not.toBe(key);
  });
});
