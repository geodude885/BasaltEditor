import { describe, expect, it } from "vitest";
import { rhythmOf } from "../audio/rhythm";
import { findPackParameter, settingsWrittenIn, STAGE_PACK } from "../model/looks";
import { Tempo } from "../model/tempo";
import type { LookCue } from "../model/types";
import { FrameMeasurer, MEASURE_HEIGHT as H, MEASURE_WIDTH as W, type FrameFeatures } from "./frames";
import { CUT_FADE_SECONDS, DEFAULT_VIDEO_LOOK_OPTIONS, keyHues, looksFromVideo, palettes, sparkleAmount, type SongRhythm, type VideoLookOptions } from "./looks";
import { cutsIn, flashesIn, stepsOf } from "./steps";

type Paint = (x: number, y: number) => [number, number, number];
const frame = (paint: Paint): Uint8ClampedArray => {
  const px = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, [r, g, b] = paint(x, y); px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255; }
  return px;
};
const flat = (r: number, g: number, b: number): Paint => () => [r, g, b];
const FPS = 24;
/** A video of the paints in turn, each for its seconds. */
type Changing = { each: (frame: number) => Paint };
function video(...parts: [Paint | Changing, number][]): FrameFeatures[] {
  const measurer = new FrameMeasurer(), out: FrameFeatures[] = [];
  let n = 0;
  for (const [paint, seconds] of parts) for (let k = 0; k < seconds * FPS; k++, n++) {
    const p = typeof paint === "function" ? paint : paint.each(n);
    out.push(measurer.measure(frame(p), n / FPS));
  }
  return out;
}
const value = (cue: LookCue, property: string) => settingsWrittenIn(cue).find(([name]) => findPackParameter(STAGE_PACK, name)?.property === property)?.[1];
const tempo = new Tempo(120);
const options = (o: Partial<VideoLookOptions> = {}): VideoLookOptions => ({ ...DEFAULT_VIDEO_LOOK_OPTIONS, ...o });

describe("measuring a frame", () => {
  it("reads a flat colour's brightness, saturation and colour, with no specks or blobs in it", () => {
    const [f] = video([flat(255, 0, 0), 1 / FPS]);
    expect(f.saturation).toBeCloseTo(1);
    expect(f.mean).toEqual([1, 0, 0]);
    expect(f.hues[0]).toBeCloseTo(1);
    expect(f.contrast).toBeCloseTo(0);
    expect([f.specks, f.blobs]).toEqual([0, 0]);
  });

  it("finds tiny bright points, their colour, and which are new", () => {
    const stars = (dx: number): Paint => (x, y) => (x - dx) % 10 === 5 && y % 10 === 5 ? [255, 240, 200] : [10, 10, 30];
    const [first, same, moved] = video([stars(0), 2 / FPS], [stars(4), 1 / FPS]);
    expect(first.specks).toBe(16 * 9);
    expect(first.speckColour![0]).toBeCloseTo(1);
    expect(same.speckTurnover).toBe(0);
    expect(moved.speckTurnover).toBe(1);
  });

  it("finds soft bright blobs, and which way they drift", () => {
    const blob = (cy: number): Paint => (x, y) => Math.hypot(x - 80, y - cy) < 5 ? [255, 255, 255] : [20, 20, 20];
    const frames = video([{ each: n => blob(60 - n * 4) }, 3 / FPS]);
    expect(frames[1].blobs).toBe(1);
    expect(frames[2].blobRise).toBeGreaterThan(0);
  });

  it("sees a darker rim than middle as a vignette", () => {
    const [f] = video([(x, y) => Math.hypot((x - 80) / 80, (y - 45) / 45) < 0.5 ? [200, 200, 200] : [0, 0, 0], 1 / FPS]);
    expect(f.vignette).toBeGreaterThan(0.5);
    expect(f.edge).toEqual([0, 0, 0]);
  });
});

describe("cuts and flashes", () => {
  it("finds a cut where the colours change at once, and none in a steady shot", () => {
    expect(cutsIn(video([flat(200, 30, 30), 1], [flat(30, 30, 200), 1]))).toEqual([1]);
    expect(cutsIn(video([flat(200, 30, 30), 2]))).toEqual([]);
  });

  it("finds a flash that comes and goes, but not a shot that stays bright", () => {
    expect(flashesIn(video([flat(80, 80, 80), 0.5], [flat(255, 255, 255), 1 / FPS], [flat(80, 80, 80), 0.5])).map(f => f.time)).toEqual([0.5]);
    expect(flashesIn(video([flat(80, 80, 80), 0.5], [flat(255, 255, 255), 0.5]))).toEqual([]);
  });

  it("starts a step at each beat and at each cut, in the chart's time", () => {
    const steps = stepsOf(video([flat(200, 30, 30), 1.25], [flat(30, 30, 200), 0.75]), 0, tempo);
    expect(steps.map(s => s.start)).toEqual([0, 0.5, 1, 1.25, 1.5]);
    expect(steps.map(s => s.cut)).toEqual([false, false, false, true, false]);
    expect(stepsOf(video([flat(0, 0, 0), 1]), 2, tempo)[0].start).toBe(2);
  });
});

describe("looks from a video", () => {
  const redThenBlue = video([flat(220, 40, 40), 2], [flat(40, 40, 220), 2]);

  it("cuts to a new look where the video cuts", () => {
    const cues = looksFromVideo(redThenBlue, tempo, options());
    const atCut = cues.find(c => c.t === 2)!;
    expect(atCut.fade).toBe(CUT_FADE_SECONDS);
    expect(value(cues[0], "_TintR")).toBe(1);
    expect(value(atCut, "_TintB")).toBe(1);
    expect(value(atCut, "_KeyHue")).toBeGreaterThan(200);
  });

  it("fades between beats so each beat's look is reached at its middle", () => {
    const steady = video([{ each: n => flat(40 + n * 4, 40, 40) }, 2]);
    const cues = looksFromVideo(steady, tempo, options({ detail: 1 }));
    expect(cues.length).toBeGreaterThan(1);
    expect(cues[0]).not.toHaveProperty("fade");
    // The last beat is cut short by the video ending, so its middle is not on the grid.
    for (const cue of cues.slice(1, -1)) expect(((cue.t! + cue.fade!) * 4) % 2).toBeCloseTo(1);
  });

  it("keeps one key hue while two share the frame, until the other is clearly stronger", () => {
    const halves = (blueShare: number): Paint => x => x < W * blueShare ? [30, 60, 230] : [230, 40, 160];
    const swaying = video(...[0.52, 0.48, 0.53, 0.47, 0.51].map(share => [halves(share), 0.5] as [Paint, number]), [halves(0.2), 0.5]);
    const hues = keyHues(stepsOf(swaying, 0, tempo)).map(k => k.hue), swayed = hues.slice(0, 5);
    expect(Math.max(...swayed) - Math.min(...swayed)).toBeLessThan(5);
    expect(Math.abs(hues[5] - hues[0])).toBeGreaterThan(45);
  });

  it("keeps its colours through a fade to white, and makes them white rather than a stray hue", () => {
    const fading = video([flat(40, 60, 230), 1], [flat(252, 255, 250), 1]);
    const steps = stepsOf(fading, 0, tempo), palette = palettes(steps);
    expect(palette.at(-1)!.hue).toBeCloseTo(palette[0].hue);
    expect(palette.at(-1)!.colourful).toBe(0);
    const cues = looksFromVideo(fading, tempo, options());
    const lastWritten = (property: string) => cues.map(c => value(c, property)).filter(v => v !== undefined).at(-1);
    expect(lastWritten("_TintAmount")).toBe(0);
    expect(lastWritten("_KeyHue")).toBeCloseTo(palette[0].hue, 0);
  });

  it("leaves glitter and motes off while the video has no more specks or blobs than usual", () => {
    const stars = (x: number, y: number): [number, number, number] => x % 10 === 5 && y % 10 === 5 ? [255, 255, 255] : [20, 20, 60];
    const cues = looksFromVideo(video([stars, 4]), tempo, options({ groups: ["Magic"] }));
    expect(value(cues[0], "_Glitter")).toBe(0);
    expect(value(cues[0], "_Motes")).toBe(0);
  });

  it("turns glitter right up in the one bar that sparkles most, and nowhere else", () => {
    const stars = (every: number): Paint => (x, y) => x % every === every >> 1 && y % every === every >> 1 ? [255, 255, 255] : [20, 20, 60];
    // Ten bars of two seconds at 120 bpm; the sixth has four times the specks.
    const cues = looksFromVideo(video([stars(10), 10], [stars(5), 2], [stars(10), 8]), tempo, options({ groups: ["Magic"] }));
    const glitterAt = (time: number) => cues.filter(c => c.t! <= time).map(c => value(c, "_Glitter")).filter(v => v !== undefined).at(-1) ?? 0;
    expect(glitterAt(11)).toBeGreaterThan(0.1);
    expect(glitterAt(11)).toBeLessThanOrEqual(0.3);
    expect(glitterAt(5)).toBe(0);
    expect(glitterAt(17)).toBe(0);
  });

  it("puts a cut's look on the nearest quarter beat, taking only the frames after the real cut", () => {
    const steps = stepsOf(video([flat(200, 30, 30), 1.1], [flat(30, 30, 200), 0.9]), 0, tempo);
    const cut = steps.find(s => s.cut)!;
    expect(cut.start).toBe(1.125);
    expect(cut.mean[2]).toBeGreaterThan(cut.mean[0]);
  });

  it("only writes what moved, never what the game sets, and keeps every value in range", () => {
    const cues = looksFromVideo(redThenBlue, tempo, options());
    expect(settingsWrittenIn(cues[1]).length).toBeLessThan(settingsWrittenIn(cues[0]).length);
    for (const cue of cues) for (const [name, v] of settingsWrittenIn(cue)) {
      const p = findPackParameter(STAGE_PACK, name)!;
      expect(["_HitFlash", "_LowHealth", "_DangerR"]).not.toContain(p.property);
      expect(v).toBeGreaterThanOrEqual(p.min);
      expect(v).toBeLessThanOrEqual(p.max);
    }
  });

  it("stays at the pack's defaults at no strength, and writes more cues with more detail", () => {
    const quiet = looksFromVideo(redThenBlue, tempo, options({ strength: 0, groups: ["Glow"] }));
    expect(quiet).toHaveLength(1);
    for (const [name, v] of settingsWrittenIn(quiet[0])) expect(v).toBeCloseTo(findPackParameter(STAGE_PACK, name)!.default);
    const drifting = video([{ each: n => flat(40 + n, 40 + n, 40) }, 4]);
    expect(looksFromVideo(drifting, tempo, options({ detail: 1 })).length).toBeGreaterThan(looksFromVideo(drifting, tempo, options({ detail: 0 })).length);
  });

  it("makes the lights the focus of a light show: a dark stage, thin quick beams, strobing at the video's own rate", () => {
    // A dark stage flashing magenta every sixth frame: four flashes a second, two a beat at 120 bpm.
    const show = video([{ each: n => n % 6 === 3 ? flat(255, 140, 235) : flat(8, 8, 20) }, 4]);
    expect(cutsIn(show)).toEqual([]);
    const cues = looksFromVideo(show, tempo, options({ groups: ["Colour", "Lights"] }));
    // In the middle: the last step is cut short by the video ending.
    const last = (property: string) => cues.filter(c => c.t! < 3).map(c => value(c, property)).filter(v => v !== undefined).at(-1)!;
    expect(last("_Darkness")).toBeGreaterThanOrEqual(0.45);
    expect(last("_Lights")).toBeGreaterThan(1);
    expect(last("_LightWidth")).toBeLessThan(0.06);
    expect(last("_LightStrobe")).toBeGreaterThan(0.6);
    expect(last("_LightStrobeRate")).toBe(2);
  });

  it("drives only the groups asked for, and gives the same cues every time", () => {
    const cues = looksFromVideo(redThenBlue, tempo, options({ groups: ["Magic"] }));
    for (const cue of cues) for (const [name] of settingsWrittenIn(cue)) expect(findPackParameter(STAGE_PACK, name)!.group).toBe("Magic");
    expect(looksFromVideo(redThenBlue, tempo, options())).toEqual(looksFromVideo(redThenBlue, tempo, options()));
  });
});

describe("looks from a video and its song", () => {
  const RATE = 22050;
  /** A song of tones: each at a frequency, from a time, dying away. */
  const song = (seconds: number, sounds: { at: number; hz: number; loud?: number }[], offset = 0): SongRhythm => {
    const out = new Float32Array(Math.round(seconds * RATE));
    for (const { at, hz, loud = 0.8 } of sounds) {
      const start = Math.round(at * RATE);
      for (let i = 0; i < RATE * 0.15 && start + i < out.length; i++) out[start + i] += loud * Math.sin(2 * Math.PI * hz * i / RATE) * Math.exp(-i / (RATE * 0.04));
    }
    return { rhythm: rhythmOf(out, RATE), offset };
  };
  const lastWritten = (cues: LookCue[], property: string, before = Infinity) => cues.filter(c => c.t! < before).map(c => value(c, property)).filter(v => v !== undefined).at(-1);
  const still = video([flat(60, 60, 160), 4]);

  it("spreads glitter and motes over their log scale, off under a little", () => {
    expect(sparkleAmount(0)).toBe(0);
    expect(sparkleAmount(0.5)).toBeCloseTo(0.032, 3);
    expect(sparkleAmount(1)).toBeCloseTo(0.2);
  });

  it("pulses with the song's kicks, not the video's stillness", () => {
    const kicksLater = song(4, [2, 2.5, 3, 3.5].map(at => ({ at, hz: 60 })));
    const cues = looksFromVideo(still, tempo, options({ groups: ["Beat"] }), kicksLater);
    expect(lastWritten(cues, "_BeatPulse", 3)!).toBeGreaterThan(lastWritten(cues, "_BeatPulse", 1.5)! + 0.3);
  });

  it("brings motes in where the song goes quiet, and keeps glitter and motes to their scales", () => {
    const loudThenQuiet = song(8, Array.from({ length: 16 }, (_, i) => ({ at: i * 0.5, hz: 300, loud: i < 8 ? 0.9 : 0.05 })));
    const cues = looksFromVideo(video([flat(60, 60, 160), 8]), tempo, options({ groups: ["Magic"] }), loudThenQuiet);
    expect(lastWritten(cues, "_Motes", 2) ?? 0).toBe(0);
    expect(lastWritten(cues, "_Motes")!).toBeGreaterThan(0);
    for (const cue of cues) {
      expect(value(cue, "_Glitter") ?? 0).toBeLessThanOrEqual(0.3);
      expect(value(cue, "_Motes") ?? 0).toBeLessThanOrEqual(0.2);
    }
  });

  it("brings the stage lights in for the song's loudest bars, and leaves them off in its quiet ones", () => {
    const quietThenLoud = song(8, Array.from({ length: 16 }, (_, i) => ({ at: i * 0.5, hz: 300, loud: i < 8 ? 0.1 : 0.9 })));
    const cues = looksFromVideo(video([flat(60, 60, 160), 8]), tempo, options({ groups: ["Lights"] }), quietThenLoud);
    expect(lastWritten(cues, "_Lights", 3) ?? 0).toBe(0);
    expect(lastWritten(cues, "_Lights")!).toBeGreaterThan(0.5);
  });

  it("puts a cut's look on the hit in the song nearest it, in the song's own time", () => {
    const cues = looksFromVideo(video([flat(200, 30, 30), 1.1], [flat(30, 30, 200), 0.9]), tempo, options(), song(4, [{ at: 3.04, hz: 200 }], 2));
    expect(cues.find(c => c.fade === CUT_FADE_SECONDS)!.t).toBeCloseTo(1.04, 1);
  });
});
