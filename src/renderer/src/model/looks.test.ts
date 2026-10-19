import { describe, expect, it } from "vitest";
import {
  convertChartLooksFromNightToStage, cssToLinear, evaluateLooksAt, findPackParameter, linearToCss, lookCueProblems, NIGHT_LOOK_IN_STAGE_SETTINGS,
  shadeCentrePixelLikeStage, STAGE_PACK, stageCueWarnings, stageDefaults, stageLookAt, stageLookBeforeCue, stageSettingsFrom, timedLookCues,
  type Rgb, type TimedLookCue,
} from "./looks";
import { Tempo } from "./tempo";
import type { LoadedChart, LookCue } from "./types";

// BossBattles Night's fragment shader, transcribed separately from Stage, for the centre of the screen
// between beats with the glow's blur seeing the same colour all around.
type NightSettings = { darkness: number; redGlow: number; glowRadius: number; blackFog: number };
function nightCentrePixel(scene: Rgb, depthMetres: number | null, n: NightSettings): Rgb {
  const redness = (c: Rgb) => Math.min(1, Math.max(0, (c[0] - Math.max(c[1], c[2])) * 2.5));
  const red = redness(scene);
  const luma = 0.2126 * scene[0] + 0.7152 * scene[1] + 0.0722 * scene[2];
  const drained = luma * (1 - 0.75 * n.darkness);
  let colour = scene.map(v => drained + (v * (1 + 0.3 * n.redGlow) - drained) * red) as Rgb;
  if (n.blackFog > 0.0001) {
    const fog = depthMetres == null ? 1 : 1 - Math.exp(-n.blackFog * depthMetres);
    const fogColour: Rgb = [0.035, 0, 0.004];
    colour = colour.map((v, i) => v + (fogColour[i] - v) * fog * (1 - 0.6 * red)) as Rgb;
  }
  if (n.redGlow > 0.001 && n.glowRadius > 0.001) {
    const glow = redness(scene) * scene[0];
    colour = colour.map((v, i) => v + [1, 0.08, 0.04][i] * glow * n.redGlow) as Rgb;
  }
  return colour;
}

const scenes: [string, Rgb, number | null][] = [
  ["grey wall", [0.18, 0.17, 0.15], 8], ["red banner", [0.7, 0.05, 0.04], 5], ["orange", [0.8, 0.35, 0.05], 12],
  ["blue", [0.05, 0.1, 0.6], 3], ["sky", [0.3, 0.45, 0.7], null], ["near red", [0.5, 0.1, 0.1], 0.5],
];

function expectSamePixel(actual: Rgb, expected: Rgb): void {
  actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 6));
}

const nightAtItsOwnDefaults = { darkness: 0.6, redGlow: 1.2, glowRadius: 3, blackFog: 0.07 };
const stageWith = (settings: Record<string, number>) => stageSettingsFrom(new Map(Object.entries(settings)));

describe("BossBattles Stage", () => {
  it("changes nothing at its defaults", () => {
    for (const [, scene, depth] of scenes) expectSamePixel(shadeCentrePixelLikeStage(scene, depth, stageDefaults()), scene);
  });

  it("renders exactly as Night with Night's look", () => {
    for (const [, scene, depth] of scenes) {
      expectSamePixel(shadeCentrePixelLikeStage(scene, depth, stageWith(NIGHT_LOOK_IN_STAGE_SETTINGS)), nightCentrePixel(scene, depth, nightAtItsOwnDefaults));
    }
  });

  it("keeps another hue instead of red when the key moves", () => {
    const green = stageWith({ ...NIGHT_LOOK_IN_STAGE_SETTINGS, "Key hue": 120, "Fog density": 0 });
    const greenObject = shadeCentrePixelLikeStage([0.05, 0.6, 0.05], 5, green);
    const redObject = shadeCentrePixelLikeStage([0.6, 0.05, 0.05], 5, green);
    expect(greenObject[1]).toBeGreaterThan(0.6);
    expect(redObject[0]).toBeCloseTo(redObject[1], 6);
  });
});

const tempoAt120 = new Tempo(120);
const chartWithLooks = (visuals: LookCue[]) => ({ events: [], bpm: 120, visuals }) as LoadedChart;

describe("converting a chart's Night cues", () => {
  const nightCues = (): LookCue[] => [
    { beat: 150, pack: "BossBattles Night", set: { "Darkness": 0.65, "Red glow": 1.7, "Black fog": 0.06, "Beat pulse": 0.55 }, fade: 0.3 },
    { beat: 0, pack: "BossBattles Night", set: { "Darkness": 0.35, "Red glow": 0.7 }, fade: 2 },
    { beat: 200, pack: "BossBattles Night", off: true, fade: 4 },
    { beat: 300, pack: "BossBattles Night", on: true },
  ];

  it("renames Night's settings and keeps each cue's shape", () => {
    const chart = chartWithLooks(nightCues());
    expect(convertChartLooksFromNightToStage(chart, tempoAt120)).toBe(4);
    expect(Object.keys(chart.visuals![0])).toEqual(["beat", "pack", "set", "fade"]);
    expect(chart.visuals![0]).toEqual({ beat: 150, pack: "BossBattles Stage", set: { "Darkness": 0.65, "Glow": 1.7, "Fog density": 0.06, "Beat pulse": 0.55 }, fade: 0.3 });
    expect(chart.visuals![2]).toEqual({ beat: 200, pack: "BossBattles Stage", off: true, fade: 4 });
    for (const converted of chart.visuals!) expect(stageCueWarnings(converted)).toEqual([]);
  });

  it("gives Night's look to the first cue by time, and to the first after an off", () => {
    const chart = chartWithLooks(nightCues());
    convertChartLooksFromNightToStage(chart, tempoAt120);
    expect(chart.visuals![1].set).toEqual({ ...NIGHT_LOOK_IN_STAGE_SETTINGS, "Darkness": 0.35, "Glow": 0.7 });
    expect(chart.visuals![3]).toEqual({ beat: 300, pack: "BossBattles Stage", set: NIGHT_LOOK_IN_STAGE_SETTINGS, on: true });
  });

  it("looks as Night did once the first fade is over", () => {
    const chart = chartWithLooks(nightCues());
    convertChartLooksFromNightToStage(chart, tempoAt120);
    const settled = stageLookAt(timedLookCues(chart, tempoAt120), tempoAt120.seconds(149));
    expect(settled.on).toBe(true);
    const night = { ...nightAtItsOwnDefaults, darkness: 0.35, redGlow: 0.7 };
    for (const [, scene, depth] of scenes) expectSamePixel(shadeCentrePixelLikeStage(scene, depth, settled.settings), nightCentrePixel(scene, depth, night));
  });
});

const cue = (time: number, set: Record<string, number>, fade = 0, extra: Partial<TimedLookCue> = {}): TimedLookCue =>
  ({ index: 0, time, pack: "BossBattles Stage", set: Object.entries(set), off: false, fade, ...extra });
const defaultsOf = (_pack: string, name: string) => findPackParameter(STAGE_PACK, name)?.default ?? 0;

describe("blending cues as the mod does", () => {
  it("fades from the player's value, part way through a fade", () => {
    const look = evaluateLooksAt([cue(10, { Darkness: 1 }, 4)], 11, defaultsOf).get("bossbattles stage")!;
    expect(look.on).toBe(true);
    expect(look.values.get("Darkness")).toBeCloseTo(0.25, 9);
  });

  it("freezes a fade where the next cue cuts in, and fades on from there", () => {
    const cues = [cue(0, { Darkness: 1 }, 4), cue(2, { Darkness: 0 }, 2)];
    expect(evaluateLooksAt(cues, 2, defaultsOf).get("bossbattles stage")!.values.get("Darkness")).toBeCloseTo(0.5, 9);
    expect(evaluateLooksAt(cues, 3, defaultsOf).get("bossbattles stage")!.values.get("Darkness")).toBeCloseTo(0.25, 9);
  });

  it("fades back to the player's own on off, and only then turns the pack off", () => {
    const cues = [cue(0, { Darkness: 1 }), cue(10, {}, 2, { off: true })];
    const halfway = evaluateLooksAt(cues, 11, defaultsOf).get("bossbattles stage")!;
    expect(halfway).toMatchObject({ on: true });
    expect(halfway.values.get("Darkness")).toBeCloseTo(0.5, 9);
    expect(evaluateLooksAt(cues, 12, defaultsOf).get("bossbattles stage")).toEqual({ on: false, values: new Map() });
  });

  it("matches settings and packs without regard to case", () => {
    const cues = [cue(0, { darkness: 0.9 }), cue(1, { DARKNESS: 0.1 }, 0, { pack: "bossbattles STAGE" })];
    const values = evaluateLooksAt(cues, 1, defaultsOf).get("bossbattles stage")!.values;
    expect([...values.keys()]).toEqual(["darkness"]);
    expect(values.get("darkness")).toBeCloseTo(0.1, 9);
  });

  it("gives what a cue starts from", () => {
    const cues = [cue(0, { Darkness: 0.2 }), { ...cue(5, { Darkness: 0.9 }, 1), index: 1 }];
    expect(stageLookBeforeCue(cues, 1).settings._Darkness).toBeCloseTo(0.2, 9);
    expect(stageLookAt(cues, 5.5).settings._Darkness).toBeCloseTo(0.55, 9);
    expect(stageLookAt([], 3)).toMatchObject({ on: false });
  });
});

describe("checking cues", () => {
  const tempo = new Tempo(120);

  it("refuses what the mod refuses", () => {
    expect(lookCueProblems({ pack: "x", t: 1, beat: 2, on: true }, 0, tempo)).toEqual(["visuals[0] has both t and beat - use one"]);
    expect(lookCueProblems({ pack: "x", beat: 2, on: true }, 1, new Tempo(undefined))).toEqual(["visuals[1].beat needs the chart's bpm"]);
    expect(lookCueProblems({ pack: " ", t: 0, off: true, set: { a: 1 } }, 2, tempo)).toEqual([
      'visuals[2] needs a pack - a RumbleReShaded pack\'s name, e.g. "UltraShade"',
      'visuals[2] has both "off" and "set" - an off fades the pack back to the player\'s own settings',
    ]);
    expect(lookCueProblems({ pack: "x", t: 0, fade: -1 }, 3, tempo)).toEqual([
      'visuals[3] needs "set" (parameter values), "on": true or "off": true', "visuals[3].fade cannot be negative (got -1)",
    ]);
  });

  it("warns about Stage settings that do nothing or get clamped", () => {
    expect(stageCueWarnings({ pack: "BossBattles Stage", t: 0, set: { "Red glow": 1, "fog_density": 0.5, "_KeyHue": 90 } })).toEqual([
      '"Red glow" is not a BossBattles Stage setting - it does nothing', "Fog density 0.5 is outside 0 to 0.3 - it is clamped",
    ]);
  });
});

describe("the Stage manifest", () => {
  it("gives each colour its R, G and B in order, in one group", () => {
    const colours = new Map<string, string[]>();
    for (const p of STAGE_PACK.parameters) if (p.colour) colours.set(p.colour, [...(colours.get(p.colour) ?? []), p.label.slice(-1) + ":" + p.group]);
    expect(colours.size).toBe(6);
    for (const [, channels] of colours) expect(channels.map(c => c[0])).toEqual(["R", "G", "B"]);
    for (const [, channels] of colours) expect(new Set(channels.map(c => c.slice(2))).size).toBe(1);
  });

  it("round-trips colours through the picker", () => {
    expect(linearToCss([0.6, 0, 0])).toBe("#cb0000");
    expect(cssToLinear("#cb0000")).toEqual([0.597, 0, 0]);
  });
});
