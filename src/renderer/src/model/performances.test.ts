import { describe, expect, it } from "vitest";
import * as Jsonc from "./jsonc";
import { renameActor } from "./edits";
import { Tempo } from "./tempo";
import { playedClips, performanceOfActor, performanceProblems, performanceRows } from "./performances";
import type { LoadedChart } from "./types";

// A duet: the performances are listed in the other order from the actors, and the lead's names no actor.
const DUET = `{
  "format": 3,
  "actors": [
    { "id": "lead", "name": "Lead", "at": { "x": -1, "z": 10 } },
    { "id": "backup", "at": { "x": 1, "z": 10 } }
  ],
  "events": [{ "t": 1, "move": "Straight", "actor": "backup" }],
  "performances": [
    { "actor": "backup", "clips": [{ "t": 0, "clip": "b1" }, { "t": 4, "clip": "b2", "mime": true }] },
    { "clips": [{ "t": 2, "clip": "l1", "start": 1, "end": 3 }] }
  ]
}`;

const tempo = new Tempo(undefined);
const parseChart = (text: string) => Jsonc.parse(text) as LoadedChart;

describe("recorded performances", () => {
  it("are a row each, in the order of the actors, labelled by name else id", () => {
    expect(performanceRows(parseChart(DUET))).toEqual([
      { performance: 1, actor: "lead", label: "Lead" },
      { performance: 0, actor: "backup", label: "backup" },
    ]);
  });

  it("put a performance without an actor on the first actor's row", () => {
    const c = parseChart(DUET);
    expect(performanceOfActor(c, "lead")).toBe(1);
    expect(performanceOfActor(c, "nobody")).toBe(-1);
  });

  it("play each clip until the next in the same performance, or its own end", () => {
    const c = parseChart(DUET), length = (clip: string) => (clip === "b1" ? 10 : undefined);
    expect(playedClips(c.performances![0].clips!, tempo, 20, length)).toEqual([
      { clip: "b1", start: 0, stop: 4, mime: false },
      { clip: "b2", start: 4, stop: 20, mime: true },
    ]);
    expect(playedClips(c.performances![1].clips!, tempo, 20, length)).toEqual([{ clip: "l1", start: 2, stop: 4, mime: false }]);
  });

  it("flag what the mod refuses: a second performance for an actor, an unknown actor, clips out of order", () => {
    const c = parseChart(DUET);
    expect(performanceProblems(c, tempo)).toEqual([]);
    c.performances!.push({ actor: "lead", clips: [{ t: 3, clip: "x" }, { t: 3, clip: "y", end: 0 }] }, { actor: "ghost", clips: [] });
    expect(performanceProblems(c, tempo)).toEqual([
      'performances[2]: "lead" already has a performance (one per actor)',
      "performances[2].clips[1] must start after the clip before it",
      "performances[2].clips[1].end must be after start",
      'performances[3].actor "ghost" is not one of the actors',
    ]);
  });

  it("follow an actor's new id, leaving a performance that names no actor alone", () => {
    const c = parseChart(DUET);
    expect(renameActor(c, 1, "harmony").sort()).toEqual(["events", "performances"]);
    expect(c.performances!.map(t => t.actor)).toEqual(["harmony", undefined]);
    expect(c.events[0].actor).toBe("harmony");
    renameActor(c, 0, "singer");
    expect(performanceRows(c).map(row => row.actor)).toEqual(["singer", "harmony"]);
    expect(c.performances![1].actor).toBeUndefined();
  });

  it("are found by the actor they name", () => {
    const c = { events: [], actors: [{ id: "a" }, { id: "b" }], performances: [{ actor: "b", clips: [] }] } as unknown as LoadedChart;
    expect(performanceOfActor(c, "b")).toBe(0);
    expect(performanceOfActor(c, "a")).toBe(-1);
  });
});
