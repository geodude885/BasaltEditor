import { describe, expect, it } from "vitest";
import { felt, impactBetween, lookImpacts, SMALL_IMPACT } from "./lookImpact";
import { findPackParameter, STAGE_PACK, stageDefaults, stageLookAt, timedLookCues } from "./looks";
import { keyMoments, simplifyLooks } from "./simplify";
import { Tempo } from "./tempo";
import type { LoadedChart, LookCue } from "./types";

const tempo = new Tempo(undefined);
const stage = (t: number, values: Record<string, number>, fade = 1): LookCue => ({ t, pack: "BossBattles Stage", fade, values });
const chartOf = (shaders: LookCue[]) => ({ events: [], shaders } as unknown as LoadedChart);
const glowAt = (chart: LoadedChart, time: number) => stageLookAt(timedLookCues(chart, tempo), time).settings._Glow;
const glitter = findPackParameter(STAGE_PACK, "Glitter")!;

describe("keeping the moments that matter", () => {
  it("drops what a straight fade reproduces, and keeps a turn and what must stay", () => {
    expect(keyMoments([0, 1, 2, 3, 4], [[0], [0.25], [0.5], [0.75], [1]], 0.05)).toEqual([0, 4]);
    expect(keyMoments([0, 1, 2, 3, 4], [[0], [0.5], [1], [0.5], [0]], 0.05)).toEqual([0, 2, 4]);
    expect(keyMoments([0, 1, 2, 3, 4], [[0], [0.25], [0.5], [0.75], [1]], 0.05, i => i === 1)).toEqual([0, 1, 4]);
  });
});

describe("simplifying looks in a chart", () => {
  // Glow held at 0 for a second (the first look starts at once, the next only fades from 1 s), then rising steadily.
  const ramp = [stage(0, { Glow: 0 }, 0), stage(1, { Glow: 0.5 }), stage(2, { Glow: 1 }), stage(3, { Glow: 1.5 }), stage(4, { Glow: 2 })];

  it("puts fewer looks in place of a steady ramp, that look the same along it", () => {
    const chart = chartOf(ramp), { remove, add } = simplifyLooks(chart, tempo, [0, 1, 2, 3, 4]);
    expect(remove).toEqual([0, 1, 2, 3, 4]);
    expect(add).toHaveLength(2);
    const after = chartOf(add);
    for (const time of [0.5, 2.5, 4.5]) expect(glowAt(after, time)).toBeCloseTo(glowAt(chart, time), 1);
  });

  it("keeps a look the ramp turns at", () => {
    const peak = [stage(0, { Glow: 0 }, 0), stage(1, { Glow: 1 }), stage(2, { Glow: 2 }), stage(3, { Glow: 1 }), stage(4, { Glow: 0 })];
    const { add } = simplifyLooks(chartOf(peak), tempo, [0, 1, 2, 3, 4]);
    const kept = add.map(c => c.values?.Glow);
    expect(kept).toContain(2);
    expect(kept.length).toBeLessThan(5);
    expect(glowAt(chartOf(add), 3.01)).toBeCloseTo(2, 1);
  });

  it("merges them into one look that ends where the last did, leaving other packs' alone", () => {
    const chart = chartOf([...ramp, { t: 2, pack: "UltraShade", values: { Saturation: 0.5 } }]);
    const { remove, add } = simplifyLooks(chart, tempo, [0, 1, 2, 3, 4, 5], { merge: true });
    expect(remove).toEqual([0, 1, 2, 3, 4]);
    expect(add).toEqual([{ t: 0, pack: "BossBattles Stage", fade: 5, values: { Glow: 2 } }]);
  });

  it("needs two Stage looks to do anything", () => {
    expect(simplifyLooks(chartOf(ramp), tempo, [2])).toEqual({ remove: [], add: [] });
  });
});

describe("how much a look changes", () => {
  it("counts glitter and motes by how they show, and colours by how much they show", () => {
    expect(felt(glitter, 0.3)).toBe(1);
    expect(felt(glitter, 0.075)).toBeCloseTo(0.5);
    const before = stageDefaults(), after = { ...stageDefaults(), _TintR: 0 };
    expect(impactBetween(before, after).total).toBe(0);
    expect(impactBetween(before, { ...after, _TintAmount: 1 }).groups.Colour).toBeCloseTo(1);
  });

  it("measures each Stage look against the one before it, and marks the small ones", () => {
    const impacts = lookImpacts(timedLookCues(chartOf([stage(0, { Glow: 1.5 }, 0), stage(2, { Glow: 1.55 }), { t: 3, pack: "UltraShade", values: {} }]), tempo));
    // The first turns the pack on: a whole change.
    expect(impacts.get(0)!.total).toBe(1);
    expect(impacts.get(1)!.total).toBeLessThan(SMALL_IMPACT);
    expect(impacts.has(2)).toBe(false);
  });
});
