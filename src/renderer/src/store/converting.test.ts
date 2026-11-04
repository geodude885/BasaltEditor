import { beforeEach, describe, expect, it, vi } from "vitest";
import { FrameMeasurer, MEASURE_HEIGHT as H, MEASURE_WIDTH as W } from "../video/frames";
import { converting } from "./converting.svelte";
import { doc } from "./document.svelte";

const flat = (r: number, g: number, b: number) => { const px = new Uint8ClampedArray(W * H * 4); for (let i = 0; i < W * H; i++) px.set([r, g, b, 255], i * 4); return px; };

beforeEach(() => {
  vi.stubGlobal("window", { setTimeout, clearTimeout });
  doc.load(`{
  "bpm": 120,
  "events": [],
  "shaders": [
    { "t": 1, "pack": "BossBattles Stage", "values": { "Glow": 2 } },
    { "t": 3, "pack": "UltraShade", "values": { "Saturation": 0.5 } },
    { "t": 30, "pack": "BossBattles Stage", "values": { "Glow": 1 } }
  ]
}`, "chart.json");
  const measurer = new FrameMeasurer();
  converting.frames = Array.from({ length: 96 }, (_, n) => measurer.measure(n < 48 ? flat(220, 40, 40) : flat(40, 40, 220), n / 24));
  converting.duration = 4;
  converting.videoStart = 0;
  converting.state = { kind: "ready" };
});

describe("adding the looks a converter made", () => {
  it("replaces the Stage looks the video spans, keeping other packs' and later ones, as one undo step", () => {
    const made = converting.cues.length;
    expect(made).toBeGreaterThan(1);
    converting.replace = true;
    converting.add();
    const shaders = doc.chart.shaders!;
    expect(shaders.filter(c => c.pack === "UltraShade")).toHaveLength(1);
    expect(shaders.some(c => c.t === 1 && c.values?.["Glow"] === 2)).toBe(false);
    expect(shaders.some(c => c.t === 30)).toBe(true);
    expect(shaders).toHaveLength(made + 2);
    doc.undo();
    expect(doc.chart.shaders).toHaveLength(3);
  });

  it("goes alongside the looks already there when asked to", () => {
    const made = converting.cues.length;
    converting.replace = false;
    converting.add();
    expect(doc.chart.shaders).toHaveLength(made + 3);
  });
});
