import { describe, expect, it } from "vitest";
import * as Jsonc from "./jsonc";
import { renameActor } from "./edits";
import { Tempo } from "./tempo";
import { playedClips, trackOfActor, trackProblems, trackRows } from "./tracks";
import type { LoadedChart } from "./types";

// A duet: the tracks are listed in the other order from the actors, and the lead's names no actor.
const DUET = `{
  "format": 2,
  "actors": [
    { "id": "lead", "name": "Lead", "at": { "x": -1, "z": 10 } },
    { "id": "backup", "at": { "x": 1, "z": 10 } }
  ],
  "events": [{ "t": 1, "move": "Straight", "actor": "backup" }],
  "tracks": [
    { "actor": "backup", "clips": [{ "t": 0, "clip": "b1" }, { "t": 4, "clip": "b2", "mime": true }] },
    { "clips": [{ "t": 2, "clip": "l1", "from": 1, "to": 3 }] }
  ]
}`;

const tempo = new Tempo(undefined);
const parseChart = (text: string) => Jsonc.parse(text) as LoadedChart;

describe("recorded tracks", () => {
  it("are a row each, in the order of the actors, labelled by name else id", () => {
    expect(trackRows(parseChart(DUET))).toEqual([
      { track: 1, actor: "lead", label: "Lead" },
      { track: 0, actor: "backup", label: "backup" },
    ]);
  });

  it("put a track without an actor on the first actor's row", () => {
    const c = parseChart(DUET);
    expect(trackOfActor(c, "lead")).toBe(1);
    expect(trackOfActor(c, "nobody")).toBe(-1);
  });

  it("play each clip until the next in the same track, or its own end", () => {
    const c = parseChart(DUET), length = (clip: string) => (clip === "b1" ? 10 : undefined);
    expect(playedClips(c.tracks![0].clips!, tempo, 20, length)).toEqual([
      { clip: "b1", start: 0, stop: 4, mime: false },
      { clip: "b2", start: 4, stop: 20, mime: true },
    ]);
    expect(playedClips(c.tracks![1].clips!, tempo, 20, length)).toEqual([{ clip: "l1", start: 2, stop: 4, mime: false }]);
  });

  it("flag what the mod refuses: a second track for an actor, an unknown actor, clips out of order", () => {
    const c = parseChart(DUET);
    expect(trackProblems(c, tempo)).toEqual([]);
    c.tracks!.push({ actor: "lead", clips: [{ t: 3, clip: "x" }, { t: 3, clip: "y", to: 0 }] }, { actor: "ghost", clips: [] });
    expect(trackProblems(c, tempo)).toEqual([
      'tracks[2]: "lead" already has a track (one per actor)',
      "tracks[2].clips[1] must start after the clip before it",
      "tracks[2].clips[1].to must be after from",
      'tracks[3].actor "ghost" is not one of the actors',
    ]);
  });

  it("follow an actor's new id, leaving a track that names no actor alone", () => {
    const c = parseChart(DUET);
    expect(renameActor(c, 1, "harmony").sort()).toEqual(["events", "tracks"]);
    expect(c.tracks!.map(t => t.actor)).toEqual(["harmony", undefined]);
    expect(c.events[0].actor).toBe("harmony");
    renameActor(c, 0, "singer");
    expect(trackRows(c).map(row => row.actor)).toEqual(["singer", "harmony"]);
    expect(c.tracks![1].actor).toBeUndefined();
  });

  it("are found by the actor they name", () => {
    const c = { events: [], actors: [{ id: "a" }, { id: "b" }], tracks: [{ actor: "b", clips: [] }] } as unknown as LoadedChart;
    expect(trackOfActor(c, "b")).toBe(0);
    expect(trackOfActor(c, "a")).toBe(-1);
  });
});
