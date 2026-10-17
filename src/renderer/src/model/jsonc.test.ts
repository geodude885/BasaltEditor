import { describe, expect, it } from "vitest";
import { parse, set } from "./jsonc";

const chart = `{
  // A comment up top.
  "name": "Old", // the title
  /* block */ "bpm": 120,
  "end": 16
}
`;

describe("parse", () => {
  it("reads comments and trailing commas", () => {
    expect(parse(`{ "a": [1, 2,], // x\n "b": "//not a comment", /* y */ }`)).toEqual({ a: [1, 2], b: "//not a comment" });
  });
});

describe("set", () => {
  it("replaces a value and keeps every comment", () => {
    const out = set(chart, "name", "New");
    expect(out).toContain('"name": "New", // the title');
    expect(out).toContain("// A comment up top.");
    expect(out).toContain("/* block */");
    expect(parse(out)).toEqual({ name: "New", bpm: 120, end: 16 });
  });

  it("matches keys case-insensitively, as the mod does", () => {
    expect(parse(set(`{ "BPM": 90 }`, "bpm", 100))).toEqual({ BPM: 100 });
  });

  it("adds a key that is not there", () => {
    expect(parse(set(chart, "cover", "cover.png"))).toEqual({ name: "Old", bpm: 120, end: 16, cover: "cover.png" });
    expect(parse(set("{}", "end", 3))).toEqual({ end: 3 });
  });

  it("removes a key in the middle, and its line", () => {
    const out = set(chart, "bpm", undefined);
    expect(parse(out)).toEqual({ name: "Old", end: 16 });
    expect(out).toContain("// the title");
  });

  it("removes the last key and the comma before it, keeping that line's comment", () => {
    const text = `{\n  "a": 1, // about a\n  "b": 2\n}\n`;
    expect(set(text, "b", undefined)).toBe(`{\n  "a": 1 // about a\n}\n`);
  });

  it("keeps a comment on the line after a removed key", () => {
    const text = `{\n  "a": 1,\n  // about b\n  "b": 2\n}`;
    const out = set(text, "a", undefined);
    expect(out).toBe(`{\n  // about b\n  "b": 2\n}`);
  });

  it("removes the only key, and keys on a shared line", () => {
    expect(parse(set(`{ "a": 1 }`, "a", undefined))).toEqual({});
    expect(set(`{ "a": 1, "b": 2 }`, "a", undefined)).toBe(`{ "b": 2 }`);
  });

  it("does nothing removing a key that is not there", () => {
    expect(set(chart, "cover", undefined)).toBe(chart);
  });

  it("writes short values on one line and long lists one item per line", () => {
    const out = set("{}", "events", [{ t: 1, move: "Straight" }, { t: 2, move: "Kick" }, { t: 3, move: "Stomp" }, { t: 4, move: "Jump" }]);
    expect(out).toContain('\n    { "t": 1, "move": "Straight" },\n');
  });
});
