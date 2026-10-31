import { describe, expect, it } from "vitest";
import { actorSpotAt, actorsOf, endOf, evTime, setEvTime, zoneOf } from "./chart";
import {
  addPhaseAt, addTempoChange, mirror, newTimed, resizeLane, setArenaSpot, setLaneColour, setMusic, setRules, setTempo, setTopLevelValueOrRemoveIfEmpty, setWallsShown, setZone, tempoList,
} from "./edits";
import { parse } from "./jsonc";
import { density, problems } from "./problems";
import { SAMPLE, template } from "./samples";
import { beatText, clockText, gridLines, SNAPS, Tempo } from "./tempo";
import type { LoadedChart } from "./types";

const load = (text: string) => { const c = parse(text) as LoadedChart; c.events ??= []; return c; };

describe("Tempo", () => {
  it("converts a single bpm", () => {
    const tp = new Tempo(120);
    expect(tp.seconds(4)).toBe(2);
    expect(tp.beat(3)).toBe(6);
  });

  it("follows tempo changes", () => {
    const tp = new Tempo(120, [{ beat: 4, bpm: 60 }]);
    expect(tp.seconds(4)).toBe(2);
    expect(tp.seconds(5)).toBe(3);
    expect(tp.beat(3)).toBe(5);
    expect(tp.bpmAt(2.5)).toBe(60);
  });

  it("needs a bpm to start from", () => {
    expect(new Tempo(undefined, [{ beat: 4, bpm: 60 }]).ok).toBe(false);
  });

  it("snaps to the beat, or to the millisecond without a tempo", () => {
    expect(new Tempo(120).snap(1.2, 1)).toBe(1);
    expect(new Tempo(120).snap(1.2, 0.5)).toBe(1.25);
    expect(new Tempo(undefined).snap(1.23456, 1)).toBe(1.235);
  });
});

describe("the sample and template", () => {
  it("have no problems", () => {
    for (const text of [SAMPLE, template("Mine", "me")]) {
      const c = load(text);
      expect(problems(c, new Tempo(c.bpm))).toEqual([]);
      expect(c.format).toBe(3);
    }
  });

  it("aim at the player by leaving `to` out, and leave the first actor unnamed", () => {
    expect(SAMPLE).not.toContain('"player"');
    expect(SAMPLE).not.toContain('"by"');
  });
});

describe("the mod's new, empty chart", () => {
  const c = load(`{
    "format": 3, "name": "My chart", "author": "me",
    "arena": { "map": "ring", "at": { "x": 0, "z": -6, "facing": 0 } },
    "lane": { "length": 12, "width": 3 },
    "actors": [ { "id": "boss", "name": "Boss", "at": { "x": 0, "z": 12 }, "look": "you", "shiftstones": [] } ],
    "events": []
  }`), tp = new Tempo(c.bpm, c.bpmChanges);

  it("has no problems, and ends 3 s after the start", () => {
    expect(problems(c, tp)).toEqual([]);
    expect(endOf(c, tp)).toBe(3);
    expect(tp.ok).toBe(false);
  });
});

describe("problems", () => {
  it("finds what the mod would refuse", () => {
    const c = load(template("x"));
    c.events.push({ t: 0.1, projectile: { structure: "Disc", from: { x: 0, y: 1, z: 99 }, speed: 0 } });
    c.events.push({ t: 2, move: "Kick", actor: "nobody" });
    c.end = 1;
    c.format = 4;
    expect(problems(c, new Tempo(c.bpm))).toEqual([
      "format 4 is newer than the mod reads (3)",
      "events[0].projectile.from.z must be over 0 and up to 18 (the lane, or 6 m past it)",
      "events[0].projectile.speed must be over 0",
      "events[0] would appear before the battle starts",
      'events[1].actor "nobody" is not one of the actors',
      "end (1) is before the last event (2)",
    ]);
  });

  it("checks tempo changes as the mod does", () => {
    const c = load(template("x"));
    c.bpmChanges = [{ beat: 0, bpm: 90 }, { beat: 8, bpm: 0 }, { beat: 4, bpm: 90 }];
    expect(problems(c, new Tempo(c.bpm, c.bpmChanges))).toEqual([
      "bpmChanges[0].beat must be after the tempo before it",
      "bpmChanges[1].bpm must be over 0",
      "bpmChanges[2].beat must be after the tempo before it",
    ]);
    delete c.bpm;
    c.bpmChanges = [{ beat: 8, bpm: 90 }];
    expect(problems(c, new Tempo(c.bpm, c.bpmChanges))).toEqual(["bpmChanges needs a bpm to start from"]);
  });
});

describe("reading a chart", () => {
  const c = load(SAMPLE), tp = new Tempo(c.bpm);

  it("times events in seconds or beats", () => {
    expect(evTime({ beat: 4 }, tp)).toBe(2);
    const e = { beat: 2 };
    setEvTime(e, 3, tp);
    expect(e).toEqual({ beat: 6 });
  });

  it('follows an actor through its "at" events', () => {
    const gunner = actorsOf(c)[0];
    expect(actorSpotAt(c, gunner, 0, tp)).toEqual({ x: 0, z: 12 });
    expect(actorSpotAt(c, gunner, 10.5, tp)).toEqual({ x: -1.2, z: 11 });
    expect(actorSpotAt(c, gunner, 19, tp)).toEqual({ x: 1.2, z: 10 });
  });

  it("defaults the zone and the end", () => {
    expect(zoneOf(c)).toEqual({ length: 10, height: 3.5 });
    const open = load(template("x"));
    delete open.end;
    open.events.push({ t: 5, move: "Kick" });
    expect(endOf(open, tp)).toBe(8);
  });

  it("measures density", () => {
    expect(density(c, tp)).toMatchObject({ shots: 12, moves: 1, peak: 2 });
  });
});

describe("edits", () => {
  it("scales everything along the lane when it is resized", () => {
    const c = load(SAMPLE);
    expect(resizeLane(c, 6)).toEqual(["lane", "events", "actors"]);
    expect(c.lane).toEqual({ length: 6, width: 3 });
    expect(c.events[0].projectile!.from.z).toBe(5);
    expect(c.actors![0].at!.z).toBe(6);
    expect(resizeLane(c, 6)).toEqual([]);
  });

  it("mirrors origins, aims and spots", () => {
    const c = load(SAMPLE);
    mirror([c.events[0], c.events[5]]);
    expect(c.events[0].projectile!.from.x).toBe(1.5);
    expect(c.events[0].projectile!.to).toEqual({ x: -1.2, y: 1.3 });
    expect(c.events[5].at!.x).toBe(1.2);
  });

  it("writes new events in beats only when the chart does", () => {
    const c = load(template("x")), tp = new Tempo(c.bpm);
    expect(newTimed(c, 1.1, tp, 1)).toEqual({ t: 1 });
    c.events.push({ beat: 1, move: "Kick" });
    expect(newTimed(c, 1.1, tp, 1)).toEqual({ beat: 2 });
  });

  it("adds phases and tempo changes in order", () => {
    const c = load(template("x")), tp = new Tempo(c.bpm);
    expect(addPhaseAt(c, 4, tp)).toBe(1);
    expect(addPhaseAt(c, 2, tp)).toBe(1);
    expect(c.phases!.map(p => p.t)).toEqual([0, 2, 4]);
    addTempoChange(c, 2, tp);
    expect(c.bpm).toBe(120);
    expect(c.bpmChanges).toEqual([{ beat: 4, bpm: 120 }]);
  });

  it("splits a tempo list into bpm and bpmChanges, without a beat 0 change", () => {
    const c = load(template("x"));
    expect(tempoList(c)).toEqual([{ beat: 0, bpm: 120 }]);
    setTempo(c, [{ beat: 8, bpm: 90 }, { beat: 0, bpm: 140 }]);
    expect(c.bpm).toBe(140);
    expect(c.bpmChanges).toEqual([{ beat: 8, bpm: 90 }]);
    expect(tempoList(c)).toEqual([{ beat: 0, bpm: 140 }, { beat: 8, bpm: 90 }]);
    setTempo(c, [{ beat: 0, bpm: 100 }]);
    expect(c.bpm).toBe(100);
    expect(c).not.toHaveProperty("bpmChanges");
  });
});

describe("settings that are more than one field", () => {
  it("removes empty top-level values", () => {
    const c = load(SAMPLE);
    setTopLevelValueOrRemoveIfEmpty(c, "end", Number.NaN);
    setTopLevelValueOrRemoveIfEmpty(c, "description", "");
    expect(c.end).toBeUndefined();
    expect(c.description).toBeUndefined();
  });

  it("writes lane colours, and removes them when none are left", () => {
    const c = load(SAMPLE);
    setLaneColour(c, "sideLines", "#ffffff");
    setLaneColour(c, "endLines", "#00ff00");
    expect(c.colours).toEqual({ sideLines: "#ffffff", endLines: "#00ff00" });
    setWallsShown(c, true, "#66ccff", 0.5);
    expect(c.colours?.walls).toBe("#66ccff80");
    setLaneColour(c, "sideLines", undefined); setLaneColour(c, "endLines", undefined); setWallsShown(c, false, "#000000", 0);
    expect(c.colours).toBeUndefined();
  });

  it("keeps zone, rules, arena spot and music tidy", () => {
    const c = load(SAMPLE);
    setZone(c, 8, undefined);
    expect(c.playerZone).toEqual({ length: 8 });
    setZone(c, undefined, undefined);
    expect(c.playerZone).toBeUndefined();
    setRules(c, "discs", -2);
    expect(c.rules).toEqual({ playerSpawns: "discs", breakStillAfter: 0 });
    setRules(c, "all", undefined, true);
    expect(c.rules).toEqual({ breakBehind: true });
    setRules(c, "all", undefined);
    expect(c.rules).toBeUndefined();
    setArenaSpot(c, 1, undefined, 90);
    expect(c.arena).toEqual({ map: "pit", at: { x: 1, z: 0, facing: 90 } });
    setArenaSpot(c, undefined, undefined, undefined);
    expect(c.arena).toEqual({ map: "pit" });
    setMusic(c, "  song.ogg ", Number.NaN, 4);
    expect(c.music).toEqual({ file: "song.ogg", offset: 0, volume: 1 });
    setMusic(c, "", 0, 1);
    expect(c.music).toBeUndefined();
  });
});

describe("clock readouts", () => {
  it("keep their width as they run", () => {
    expect(clockText(0, 2)).toBe("0:00.00");
    expect(clockText(5.1, 2)).toBe("0:05.10");
    expect(clockText(65, 3)).toBe("1:05.000");
    expect(clockText(59.9996, 3)).toBe("1:00.000");
    expect(clockText(119.6, 0)).toBe("2:00");
    expect(beatText(4, 1)).toBe("5.0");
    expect(beatText(4.25, 2)).toBe("5.25");
  });
});

describe("triplet snaps", () => {
  it("snap to thirds, sixths and twelfths of a beat", () => {
    const tp = new Tempo(120);
    expect(tp.beat(tp.snap(tp.seconds(0.3), 1 / 3))).toBeCloseTo(1 / 3, 3);
    expect(tp.beat(tp.snap(tp.seconds(2.9), 1 / 6))).toBeCloseTo(17 / 6, 3);
    expect(tp.beat(tp.snap(tp.seconds(1.05), 1 / 12))).toBeCloseTo(13 / 12, 3);
  });

  it("draw grid lines counted in whole steps, so bars still land on bars", () => {
    const lines = gridLines(0, 8, 1 / 3);
    expect(lines).toHaveLength(25);
    expect(lines.at(-1)!.beat).toBe(8);
    expect(lines.filter(l => l.whole).map(l => l.beat)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(lines.filter(l => l.bar).map(l => l.beat)).toEqual([0, 4, 8]);
    expect(gridLines(2, 3, 1).map(l => l.beat)).toEqual([2, 3]);
  });

  it("are offered beside the straight ones", () => {
    expect(SNAPS.flatMap(g => g.snaps.map(([beats]) => beats))).toEqual([1, 1 / 2, 1 / 4, 1 / 8, 1 / 3, 1 / 6, 1 / 12]);
  });
});
