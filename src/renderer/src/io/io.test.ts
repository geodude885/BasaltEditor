/// <reference types="node" />
import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { clipSpans, findSong, isCover, isSong, songType, readEntries, relative } from "./files";
import { crc32, readZip, writeZip } from "./zip";

const bytes = (s: string) => new TextEncoder().encode(s);
const text = (b: Uint8Array | undefined) => new TextDecoder().decode(b);

describe("zip", () => {
  it("reads back what it writes", async () => {
    const files = await readZip(writeZip([["chart.json", bytes("{}")], ["clips/a.json", bytes("[1]")]]));
    expect([...files.keys()]).toEqual(["chart.json", "clips/a.json"]);
    expect(text(files.get("clips/a.json"))).toBe("[1]");
  });

  it("reads deflated entries, as other zip tools write them", async () => {
    expect(text((await readZip(deflatedZip("chart.json", "{ \"name\": \"packed\" }"))).get("chart.json"))).toBe('{ "name": "packed" }');
  });

  it("skips paths that would leave the folder", async () => {
    const files = await readZip(writeZip([["../evil.json", bytes("x")], ["/abs.json", bytes("x")], ["ok.json", bytes("x")]]));
    expect([...files.keys()]).toEqual(["ok.json"]);
  });

  it("refuses what is not a zip", async () => {
    await expect(readZip(bytes("not a zip at all, just some words"))).rejects.toThrow("it is not a zip");
  });
});

describe("opening files", () => {
  it("finds the chart and puts loose clips in clips/", async () => {
    const opened = await readEntries([
      { path: "song.mp3", bytes: bytes("ID3") },
      { path: "chart.json", bytes: bytes("{}") },
      { path: "boss-take-1.json", bytes: bytes("{}") },
    ]);
    expect(opened.chart?.name).toBe("chart.json");
    expect([...opened.files.keys()].sort()).toEqual(["clips/boss-take-1.json", "song.mp3"]);
  });

  it("opens a package with its chart in a folder", async () => {
    const pack = writeZip([["Mine/chart.json", bytes('{"name":"Mine"}')], ["Mine/song.ogg", bytes("OggS")]]);
    const opened = await readEntries([{ path: "Mine.bbchart", bytes: pack }]);
    expect(opened.chart).toEqual({ text: '{"name":"Mine"}', name: "Mine.bbchart" });
    expect([...opened.files.keys()]).toEqual(["song.ogg"]);
  });

  it("keeps paths relative to the chart", () => {
    expect(relative("Mine/clips/a.json", "Mine/chart.json")).toBe("clips/a.json");
    expect(relative("Mine/cover.png", "Mine/chart.json")).toBe("cover.png");
  });

  it("names a song's media type, so the player needn't guess", () => {
    expect(songType("Music/Bound 2.MP3")).toBe("audio/mpeg");
    expect(songType("a.ogg")).toBe("audio/ogg");
    expect(songType("a.wav")).toBe("audio/wav");
  });

  it("tells songs and covers from other files", () => {
    expect(isSong("Music/Song.MP3")).toBe(true);
    expect(isSong("song.flac")).toBe(false);
    expect(isCover("cover.JPEG")).toBe(true);
    expect(isCover("clips/a.json")).toBe(false);
  });

  it("finds the named song, or any song", () => {
    const files = new Map([["Music/Song.MP3", bytes("")], ["other.ogg", bytes("")]]);
    expect(findSong(files, "song.mp3")).toBe("Music/Song.MP3");
    expect(findSong(new Map([["a.png", bytes("")], ["b.ogg", bytes("")]]))).toBe("b.ogg");
  });

  it("measures recorded clips", () => {
    const clip = bytes(JSON.stringify({ Name: "boss-take-1", Frames: [{ T: 0.5 }, { T: 4 }] }));
    expect(clipSpans(new Map([["clips/x.json", clip], ["cover.png", bytes("")]]))).toEqual(new Map([["boss-take-1", { start: 0.5, end: 4 }]]));
  });
});

/** A one-file zip with its entry deflated. */
function deflatedZip(name: string, content: string): Uint8Array {
  const data = bytes(content), packed = deflateRawSync(data), nameBytes = bytes(name);
  const local = new DataView(new ArrayBuffer(30));
  local.setUint32(0, 0x04034b50, true); local.setUint16(8, 8, true); local.setUint32(14, crc32(data), true);
  local.setUint32(18, packed.length, true); local.setUint32(22, data.length, true); local.setUint16(26, nameBytes.length, true);
  const head = new DataView(new ArrayBuffer(46));
  head.setUint32(0, 0x02014b50, true); head.setUint16(10, 8, true); head.setUint32(16, crc32(data), true);
  head.setUint32(20, packed.length, true); head.setUint32(24, data.length, true); head.setUint16(28, nameBytes.length, true);
  const end = new DataView(new ArrayBuffer(22)), centralAt = 30 + nameBytes.length + packed.length;
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, 1, true); end.setUint16(10, 1, true);
  end.setUint32(12, 46 + nameBytes.length, true); end.setUint32(16, centralAt, true);
  const parts = [new Uint8Array(local.buffer), nameBytes, packed, new Uint8Array(head.buffer), nameBytes, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
