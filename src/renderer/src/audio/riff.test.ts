import { describe, expect, it } from "vitest";
import { mp3InsideWav } from "./riff";

/** A WAV file: RIFF header, then chunks of [id, body]. */
function wav(chunks: [string, Uint8Array][]): Uint8Array {
  const parts: number[] = [];
  const word = (s: string) => [...s].forEach(c => parts.push(c.charCodeAt(0)));
  const u32 = (n: number) => parts.push(n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255);
  word("RIFF"); u32(0); word("WAVE");
  for (const [id, body] of chunks) {
    word(id); u32(body.length); parts.push(...body);
    if (body.length % 2) parts.push(0);
  }
  return new Uint8Array(parts);
}
const fmt = (format: number) => new Uint8Array([format & 255, format >> 8, 2, 0]);

describe("MP3 inside a WAV", () => {
  it("finds the MP3 data", () => {
    const mp3 = new Uint8Array([0xff, 0xfb, 0x90, 0x44, 1]);
    const found = mp3InsideWav(wav([["fmt ", fmt(0x55)], ["fact", new Uint8Array(3)], ["data", mp3]]));
    expect(found && [...found]).toEqual([...mp3]);
  });

  it("leaves ordinary WAVs and other files alone", () => {
    expect(mp3InsideWav(wav([["fmt ", fmt(1)], ["data", new Uint8Array(4)]]))).toBeNull();
    expect(mp3InsideWav(new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull();
    expect(mp3InsideWav(new Uint8Array(4))).toBeNull();
  });
});
