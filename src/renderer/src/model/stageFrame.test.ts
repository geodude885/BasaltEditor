import { describe, expect, it } from "vitest";
import { linearToSrgb, shadeCentrePixelLikeStage, stageCueAt, stageDefaults, stageSettingsFrom, type Rgb, type StageLook, type TimedLookCue } from "./looks";
import { paintStageScene, shadeStageFrame, stageFrameKey, stageStrip, type StageFight, type StageScene } from "./stageFrame";

const between: StageFight = { beatFraction: null, health: 1, hit: 0 };
const look = (settings: Record<string, number>, on = true): StageLook => ({ on, settings: stageSettingsFrom(new Map(Object.entries(settings))) });
function stageFrameBytes(scene: StageScene, look: StageLook, fight: StageFight): Uint8ClampedArray {
  const out = new Uint8ClampedArray(scene.width * scene.height * 4);
  shadeStageFrame(scene, look, fight, out);
  return out;
}

const byte = (v: number) => Math.round(linearToSrgb(v) * 255);

function flat(colour: Rgb, depth: number, size = 9): StageScene {
  const scene = { width: size, height: size, colour: new Float32Array(size * size * 3), depth: new Float32Array(size * size).fill(depth) };
  for (let i = 0; i < size * size; i++) scene.colour.set(colour, i * 3);
  return scene;
}

const pixel = (bytes: Uint8ClampedArray, scene: StageScene, x: number, y: number) => [...bytes.slice((y * scene.width + x) * 4, (y * scene.width + x) * 4 + 3)];
const centre = (bytes: Uint8ClampedArray, scene: StageScene) => pixel(bytes, scene, scene.width >> 1, scene.height >> 1);

describe("the look preview's frame", () => {
  const night = { "Saturation": 0, "Darkness": 0.6, "Glow": 1.2, "Fog density": 0.07, "Vignette": 0.4 };

  it("is the scene untouched at Stage's defaults, and with the pack off", () => {
    const scene = paintStageScene(48, 27, 0);
    const untouched = stageFrameBytes(scene, look({}, false), between);
    expect(stageFrameBytes(scene, { on: true, settings: stageDefaults() }, { beatFraction: 0, health: 0.2, hit: 1 })).toEqual(untouched);
    expect(stageFrameBytes(scene, look(night, false), between)).toEqual(untouched);
  });

  it("adds Magic's sparkle only when it is turned up, the same at the same moment", () => {
    const scene = paintStageScene(96, 54, 0), still = { ...between, time: 3 };
    const plain = stageFrameBytes(scene, look({}), still);
    const magical = look({ "Glitter": 2, "Glitter density": 1, "Glitter size": 0.2, "Motes": 2, "Twinkle speed": 0 });
    const sparkling = stageFrameBytes(scene, magical, still);

    expect(sparkling).not.toEqual(plain);
    expect([...sparkling].every((v, i) => v >= plain[i])).toBe(true);
    expect(stageFrameBytes(scene, magical, still)).toEqual(sparkling);
  });

  it("shades a flat scene's centre as the one-pixel preview does", () => {
    for (const [colour, depth] of [[[0.7, 0.05, 0.04], 5], [[0.18, 0.17, 0.15], 8], [[0.3, 0.45, 0.7], Infinity]] as [Rgb, number][]) {
      const scene = flat(colour, depth), expected = shadeCentrePixelLikeStage(colour, depth === Infinity ? null : depth, look(night).settings);
      const shaded = centre(stageFrameBytes(scene, look(night), between), scene);
      expected.map(byte).forEach((v, i) => expect(Math.abs(shaded[i] - v)).toBeLessThanOrEqual(1));
    }
  });

  it("darkens the edges with the vignette and reddens them when hurt, but not the centre", () => {
    const scene = flat([0.4, 0.4, 0.4], 5, 21);
    const calm = stageFrameBytes(scene, look({ "Vignette": 1, "Low health": 1 }), between);
    const hurt = stageFrameBytes(scene, look({ "Vignette": 1, "Low health": 1 }), { ...between, health: 0 });
    expect(pixel(calm, scene, 0, 0)[0]).toBeLessThan(centre(calm, scene)[0]);
    expect(pixel(hurt, scene, 0, 0)[0]).toBeGreaterThan(pixel(hurt, scene, 0, 0)[1] + 50);
    expect(centre(hurt, scene)).toEqual(centre(calm, scene));
  });

  it("flashes on the beat and not between", () => {
    const scene = flat([0.2, 0.2, 0.2], 5);
    const flash = look({ "Beat flash": 0.5 });
    expect(centre(stageFrameBytes(scene, flash, { ...between, beatFraction: 0 }), scene)[0]).toBeGreaterThan(centre(stageFrameBytes(scene, flash, between), scene)[0]);
    expect(centre(stageFrameBytes(scene, flash, { ...between, beatFraction: 0.99 }), scene)[0]).toBeLessThan(centre(stageFrameBytes(scene, flash, { ...between, beatFraction: 0 }), scene)[0]);
  });

  it("paints things in the key colour whatever the key hue is", () => {
    for (const hue of [0, 120, 240]) {
      const scene = paintStageScene(64, 36, hue);
      const keyKept = stageFrameBytes(scene, look({ "Key hue": hue, "Saturation": 0 }), between);
      let coloured = 0;
      for (let i = 0; i < 64 * 36; i++) if (Math.max(keyKept[i * 4], keyKept[i * 4 + 1], keyKept[i * 4 + 2]) - Math.min(keyKept[i * 4], keyKept[i * 4 + 1], keyKept[i * 4 + 2]) > 60) coloured++;
      expect(coloured).toBeGreaterThan(10);
    }
  });
});

describe("skipping frames that would look the same", () => {
  it("ignores the beat and the fight unless the look uses them", () => {
    const still = look({ "Darkness": 0.5 }), beating = look({ "Beat flash": 0.3 }), hurting = look({ "Low health": 1 });
    const onTheBeat = { ...between, beatFraction: 0 }, offTheBeat = { ...between, beatFraction: 0.5 }, low = { ...between, health: 0.2 };
    expect(stageFrameKey(still, onTheBeat)).toBe(stageFrameKey(still, offTheBeat));
    expect(stageFrameKey(still, low)).toBe(stageFrameKey(still, between));
    expect(stageFrameKey(beating, onTheBeat)).not.toBe(stageFrameKey(beating, offTheBeat));
    expect(stageFrameKey(hurting, low)).not.toBe(stageFrameKey(hurting, between));
    expect(stageFrameKey(look({ "Darkness": 0.5 }, false), onTheBeat)).toBe(stageFrameKey(look({}, false), low));
  });
});

describe("which cue the look is following", () => {
  const cue = (index: number, time: number, fade: number, pack = "BossBattles Stage"): TimedLookCue => ({ index, time, pack, values: [], off: false, fade });

  it("is the last Stage cue so far, part way through its fade", () => {
    const cues = [cue(0, 2, 4), cue(1, 3, 0, "UltraShade"), cue(2, 10, 2)];
    expect(stageCueAt(cues, 1)).toBeNull();
    expect(stageCueAt(cues, 4)).toEqual({ cue: cues[0], progress: 0.5 });
    expect(stageCueAt(cues, 11)).toEqual({ cue: cues[2], progress: 0.5 });
  });
});

describe("the timeline's strip", () => {
  const channels = (css: string) => [1, 3, 5].map(at => parseInt(css.slice(at, at + 2), 16));
  const bands = (strip: ReturnType<typeof stageStrip>) => [strip.sky, strip.surroundings, strip.keyColoured];

  it("is the arena as it is at Stage's defaults, with no sparkle", () => {
    const plain = stageStrip({ on: true, settings: stageDefaults() }), off = stageStrip(look({}, false));
    expect(bands(plain)).toEqual(bands(off));
    expect(plain.sparkle).toBeNull();
  });

  it("paints its key band in the key hue", () => {
    const [r, g] = channels(stageStrip(look({ "Key hue": 120 })).keyColoured);
    expect(g).toBeGreaterThan(r);
  });

  it("glows the key band only as much as the glow reaches round small things", () => {
    const [r, g, b] = channels(stageStrip(look({ "Glow": 3 })).keyColoured);
    expect(r).toBeGreaterThan(channels(stageStrip(look({})).keyColoured)[0]);
    expect(Math.min(g, b)).toBeLessThan(200);
  });

  it("sums up the sparkle for the overlay", () => {
    const strip = stageStrip(look({ "Glitter": 2, "Glitter density": 0.5, "Motes": 1 }));
    expect(strip.sparkle).toMatchObject({ glitter: 1, motes: 1 });
    expect(stageStrip(look({ "Glitter": 2, "Glitter density": 0.5, "Motes": 1 }))).toBe(strip);
  });
});
