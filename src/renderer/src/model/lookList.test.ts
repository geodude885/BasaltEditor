import { describe, expect, it } from "vitest";
import { colourAcross, fadeAcross, settingAcross, valueToSet } from "./lookBatch";
import { lookInEffect, lookSections, lookSummary, packsIn, rowsBetween } from "./lookList";
import { findPackParameter, STAGE_PACK } from "./looks";
import { MIXED } from "./batch";
import { Tempo } from "./tempo";
import type { LoadedChart, LookCue } from "./types";

const stage = (t: number, values: Record<string, number> = {}, extra: Partial<LookCue> = {}): LookCue => ({ t, pack: "BossBattles Stage", values, ...extra });
const chartOf = (shaders: LookCue[], phases?: { name?: string; t: number }[]) => ({ events: [], shaders, phases } as unknown as LoadedChart);
const tempo = new Tempo(120);
const glow = findPackParameter(STAGE_PACK, "Glow")!;

describe("the Looks tab's list", () => {
  const looks = [stage(0, { Glow: 1 }), stage(5, { Lights: 1, "Light beams": 6, Glitter: 0.1 }), { t: 9, pack: "UltraShade", values: { Saturation: 0.5 } }, stage(30, {}, { off: true })];

  it("groups looks under the chart's phases, or every eight bars without them", () => {
    const byPhase = lookSections(chartOf(looks, [{ name: "Intro", t: 0 }, { name: "Chorus", t: 8 }]), tempo);
    expect(byPhase.map(s => [s.title, s.rows.map(r => r.index)])).toEqual([["Intro · 0:00.0", [0, 1]], ["Chorus · 0:08.0", [2, 3]]]);
    // Eight bars at 120 bpm are 16 s.
    expect(lookSections(chartOf(looks), tempo).map(s => [s.title, s.rows.length])).toEqual([["Bars 1–8", 3], ["Bars 9–16", 1]]);
  });

  it("sums each look up, and filters by pack or by what it sets", () => {
    expect(lookSummary(looks[1])).toBe("sets 3 · Magic, Lights");
    expect(lookSummary(looks[3])).toBe("turns off");
    expect(lookSummary(stage(1))).toBe("turns on");
    expect(packsIn(chartOf(looks))).toEqual(["BossBattles Stage", "UltraShade"]);
    const rows = (filter: { pack: string | null; group: string | null }) => lookSections(chartOf(looks), tempo, filter).flatMap(s => s.rows.map(r => r.index));
    expect(rows({ pack: "UltraShade", group: null })).toEqual([2]);
    expect(rows({ pack: null, group: "Lights" })).toEqual([1]);
  });

  it("knows the look in effect at a time, and the looks between two rows", () => {
    const chart = chartOf(looks);
    expect(lookInEffect(chart, tempo, -1)).toBe(-1);
    expect(lookInEffect(chart, tempo, 6)).toBe(1);
    expect(lookInEffect(chart, tempo, 100)).toBe(3);
    const sections = lookSections(chart, tempo);
    expect(rowsBetween(sections, 3, 1)).toEqual([1, 2, 3]);
  });
});

describe("several looks at once", () => {
  it("says whether all, some or none of them set a setting, and what they share", () => {
    expect(settingAcross([stage(0, { Glow: 1 }), stage(1, { Glow: 1 })], glow)).toEqual({ sets: "all", value: 1 });
    expect(settingAcross([stage(0, { Glow: 1 }), stage(1, { Glow: 2 })], glow)).toEqual({ sets: "all", value: MIXED });
    expect(settingAcross([stage(0, { Glow: 1 }), stage(1)], glow)).toEqual({ sets: "some", value: 1 });
    expect(settingAcross([stage(0), stage(1)], glow)).toEqual({ sets: "none", value: null });
    expect(fadeAcross([stage(0, {}, { fade: 1 }), stage(1, {}, { fade: 1 })])).toBe(1);
  });

  it("reads a colour's three channels together", () => {
    const red = { "Glow colour R": 1, "Glow colour G": 0, "Glow colour B": 0 };
    expect(colourAcross([stage(0, red), stage(1, red)], "Glow colour")).toEqual({ sets: "all", value: [1, 0, 0] });
    expect(colourAcross([stage(0, red), stage(1, { "Glow colour R": 0.5 })], "Glow colour").value).toBe(MIXED);
  });

  it("gives a newly ticked setting the value they share, else the first one's, else the default", () => {
    expect(valueToSet([stage(0, { Glow: 2 }), stage(1)], glow)).toBe(2);
    expect(valueToSet([stage(0, { Glow: 2 }), stage(1, { Glow: 1 })], glow)).toBe(2);
    expect(valueToSet([stage(0), stage(1)], glow)).toBe(glow.default);
  });
});
