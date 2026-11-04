import { describe, expect, it } from "vitest";
import { STAGE_PACK } from "../model/looks";
import { Tempo } from "../model/tempo";
import { coverageByGroup, defaultOptions, findConverter, LOOK_CONVERTERS } from "./converters";
import { FrameMeasurer, MEASURE_HEIGHT as H, MEASURE_WIDTH as W, type FrameFeatures } from "./frames";
import { DEFAULT_VIDEO_LOOK_OPTIONS, looksFromVideo, palettes, settingsForStep } from "./looks";
import { stepsOf } from "./steps";
import { LEAVES, MAKES, videoConverter } from "./videoConverter";

const flat = (r: number, g: number, b: number) => { const px = new Uint8ClampedArray(W * H * 4); for (let i = 0; i < W * H; i++) px.set([r, g, b, 255], i * 4); return px; };
function video(seconds: number, paint: (frame: number) => Uint8ClampedArray): FrameFeatures[] {
  const measurer = new FrameMeasurer();
  return Array.from({ length: seconds * 24 }, (_, n) => measurer.measure(paint(n), n / 24));
}
const tempo = new Tempo(120);
const redThenBlue = video(4, n => n < 48 ? flat(220, 40, 40) : flat(40, 40, 220));

describe("the converters", () => {
  it("each say, for every setting of the pack, whether they make it and how or why not", () => {
    for (const converter of LOOK_CONVERTERS) {
      expect(converter.coverage.map(c => c.property)).toEqual(STAGE_PACK.parameters.map(p => p.property));
      for (const entry of converter.coverage) expect(entry.how).not.toBe("");
    }
  });

  it("find one by its id, falling back to the first, with its options at their defaults", () => {
    expect(findConverter("music-video")).toBe(videoConverter);
    expect(findConverter("nothing")).toBe(LOOK_CONVERTERS[0]);
    expect(defaultOptions(videoConverter)).toEqual({ strength: DEFAULT_VIDEO_LOOK_OPTIONS.strength, detail: DEFAULT_VIDEO_LOOK_OPTIONS.detail, groups: DEFAULT_VIDEO_LOOK_OPTIONS.groups });
  });

  it("list their coverage by the pack's groups, a colour's channels as one", () => {
    const glow = coverageByGroup(videoConverter).find(g => g.group === "Glow")!;
    expect(glow.made.map(m => m.name)).toEqual(["Glow", "Glow radius", "Glow colour"]);
    expect(glow.left.map(m => m.name)).toEqual(["Kaleidoscope", "Kaleidoscope radius"]);
  });
});

describe("the music video converter", () => {
  it("says it makes exactly what its rules write, and leaves the rest", () => {
    const steps = stepsOf(redThenBlue, 0, tempo);
    const written = Object.keys(settingsForStep(steps[0], palettes(steps)[0], { specks: 1, blobs: 1, motion: 0.01 }, 2,
      { kick: 0.5, snare: 0.5, hat: 0.5, loud: 1, rank: 0.5 })).sort();
    expect(Object.keys(MAKES).sort()).toEqual(written);
    expect(Object.keys(MAKES).filter(p => p in LEAVES)).toEqual([]);
    for (const p of STAGE_PACK.parameters) expect(p.property in MAKES || p.property in LEAVES).toBe(true);
  });

  it("makes what the rules make, with the video where the editor says it starts", () => {
    const made = videoConverter.generate({ frames: redThenBlue, song: null, tempo, videoStart: 2 }, { ...defaultOptions(videoConverter), detail: 0.8 });
    expect(made).toEqual(looksFromVideo(redThenBlue, tempo, { ...DEFAULT_VIDEO_LOOK_OPTIONS, offset: 2, detail: 0.8 }));
    expect(made[0].t).toBeGreaterThanOrEqual(2);
  });
});
