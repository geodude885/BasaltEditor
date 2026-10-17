import { describe, expect, it } from "vitest";
import { actorSpotAt, actorsOf, endOf, evTime, setEvTime, zoneOf } from "./chart";
import { addPhaseAt, addTempoChange, mirror, newTimed, resizeLane } from "./edits";
import { parse } from "./jsonc";
import { density, problems } from "./problems";
import { SAMPLE, template } from "./samples";
import { Tempo } from "./tempo";
import type { LoadedChart } from "./types";

const load = (text: string) => { const c = parse(text) as LoadedChart; c.events ??= []; return c; };

describe("Tempo", () => {
  it("converts a single bpm", () => {
    const tp = new Tempo(120);
    expect(tp.seconds(4)).toBe(2);
    expect(tp.beat(3)).toBe(6);
  });

  it("follows tempo changes", () => {
    const tp = new Tempo([{ beat: 0, bpm: 120 }, { beat: 4, bpm: 60 }]);
    expect(tp.seconds(4)).toBe(2);
    expect(tp.seconds(5)).toBe(3);
    expect(tp.beat(3)).toBe(5);
    expect(tp.bpmAt(2.5)).toBe(60);
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
    }
  });
});

describe("problems", () => {
  it("finds what the mod would refuse", () => {
    const c = load(template("x"));
    c.events.push({ t: 0.1, projectile: { structure: "Disc", from: { x: 0, y: 1, z: 99 }, speed: 0 } });
    c.events.push({ t: 2, move: "Kick", actor: "nobody" });
    c.end = 1;
    expect(problems(c, new Tempo(c.bpm))).toEqual([
      "events[0].projectile.from.z must be over 0 and up to 18 (the lane, or 6 m past it)",
      "events[0].projectile.speed must be over 0",
      "events[0] would appear before the battle starts",
      'events[1].actor "nobody" is not one of the actors',
      "end (1) is before the last event (2)",
    ]);
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

  it("follows an actor through phases and spot events", () => {
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
    expect(resizeLane(c, 6)).toEqual(["lane", "events", "phases", "actors"]);
    expect(c.lane).toEqual({ length: 6, width: 3 });
    expect(c.events[0].projectile!.from.z).toBe(5);
    expect(c.actors![0].at!.z).toBe(6);
    expect(c.phases![1].at!.z).toBe(5);
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
    expect(c.phases!.map(p => p.start)).toEqual([0, 2, 4]);
    addTempoChange(c, 2, tp);
    expect(c.bpm).toEqual([{ beat: 0, bpm: 120 }, { beat: 4, bpm: 120 }]);
  });
});
