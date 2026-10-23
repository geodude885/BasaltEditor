import { describe, expect, it } from "vitest";
import { summaryOfText } from "./summary";

const cover = new Uint8Array([1, 2, 3]);

describe("a chart folder's summary", () => {
  it("reads the card's details from chart.json, comments and all", () => {
    const text = `{
      // A chart
      "name": "NI4NI", "author": "ACutiePi", "difficulty": "Hard", "cover": "cover.png",
      "music": { "file": "song.mp3" },
      "events": [ { "beat": 1, "projectile": {} }, { "beat": 2, "move": "Jump" }, { "beat": 3, "projectile": {} } ],
    }`;
    const s = summaryOfText("C:/Charts/ni4ni", text, new Map([["cover.png", cover], ["other.png", new Uint8Array()]]), 5);
    expect(s).toMatchObject({ id: "C:/Charts/ni4ni", name: "NI4NI", author: "ACutiePi", difficulty: "Hard", projectiles: 2, song: "song.mp3", updated: 5 });
    expect(s.cover).toBe(cover);
  });

  it("names a chart that won't parse, or has no name, after its folder", () => {
    expect(summaryOfText("C:\\Charts\\my-chart", "{ broken", new Map(), 1).name).toBe("my-chart");
    expect(summaryOfText("/charts/second/", `{ "events": [] }`, new Map(), 1)).toMatchObject({ name: "second", projectiles: 0 });
  });

  it("takes any image as the cover when the chart names none", () => {
    expect(summaryOfText("x", "{}", new Map([["art.jpg", cover]]), 1).cover).toBe(cover);
  });
});
