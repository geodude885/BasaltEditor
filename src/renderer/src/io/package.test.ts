import { describe, expect, it } from "vitest";
import * as Jsonc from "../model/jsonc";
import { fileProblems, packageContents } from "./files";

/** MP3 audio in a WAV wrapper: RIFF, a "fmt " chunk saying MPEG layer 3, then the MP3 as "data". */
function wrapped(mp3: Uint8Array): Uint8Array {
  const parts: number[] = [];
  const word = (s: string) => [...s].forEach(c => parts.push(c.charCodeAt(0)));
  const u32 = (n: number) => parts.push(n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255);
  word("RIFF"); u32(0); word("WAVE");
  word("fmt "); u32(4); parts.push(0x55, 0, 2, 0);
  word("data"); u32(mp3.length); parts.push(...mp3);
  return new Uint8Array(parts);
}

const bytes = (n: number) => new Uint8Array([n]);
const text = `{ "name": "Test", "music": { "file": "song.mp3", "start": 0.5 }, "cover": "cover.png", "events": [] }`;
const chart = { music: { file: "song.mp3", start: 0.5 }, cover: "cover.png" };

describe("what a package holds", () => {
  it("takes chart.json, the chart's own song and cover, and its clips - nothing else", () => {
    const files = new Map([
      ["song.mp3", bytes(1)], ["other.ogg", bytes(2)], ["cover.png", bytes(3)], ["art.jpg", bytes(4)],
      ["clips/boss-take-1.json", bytes(5)], ["chart.json.bak", bytes(6)], ["chart.json.broken", bytes(7)],
    ]);
    const { entries, unwrapped } = packageContents(text, chart, files);
    expect(entries.map(e => e.path)).toEqual(["chart.json", "song.mp3", "cover.png", "clips/boss-take-1.json"]);
    expect(new TextDecoder().decode(entries[0].bytes)).toBe(text);
    expect(unwrapped).toBeUndefined();
  });

  it("puts in the MP3 inside a WAV wrapper, and names it in chart.json", () => {
    const mp3 = new Uint8Array([0xff, 0xfb, 0x90, 0x44]);
    const wavChart = { music: { file: "song.wav", start: 0.5 } };
    const wavText = Jsonc.set(text, "music", wavChart.music);
    const { entries, unwrapped } = packageContents(wavText, wavChart, new Map([["song.wav", wrapped(mp3)]]));
    expect(unwrapped).toBe("song.mp3");
    expect(entries.map(e => e.path)).toEqual(["chart.json", "song.mp3"]);
    expect([...entries[1].bytes]).toEqual([...mp3]);
    const packaged = Jsonc.parse(new TextDecoder().decode(entries[0].bytes)) as { music: { file: string; start: number } };
    expect(packaged.music).toEqual({ file: "song.mp3", start: 0.5 });
  });

  it("leaves out a song and cover the chart doesn't name", () => {
    const files = new Map([["song.mp3", bytes(1)], ["cover.png", bytes(3)]]);
    expect(packageContents("{}", {}, files).entries.map(e => e.path)).toEqual(["chart.json"]);
  });
});

describe("problems with the chart's files", () => {
  it("flags a song the game can't read, and only that", () => {
    expect(fileProblems(new Map([["song.mp3", wrapped(bytes(1))]]), chart)).toHaveLength(1);
    expect(fileProblems(new Map([["song.mp3", bytes(1)]]), chart)).toEqual([]);
    expect(fileProblems(new Map([["other.mp3", wrapped(bytes(1))]]), chart)).toEqual([]);
  });
});
