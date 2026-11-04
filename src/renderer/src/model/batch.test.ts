import { describe, expect, it } from "vitest";
import { aimOf, MIXED, setAim, setAimMode, setOffset, shared } from "./batch";
import { aimPointOf } from "./chart";
import { mirror } from "./edits";
import { parse, set } from "./jsonc";
import { problems, warnings } from "./problems";
import { Tempo } from "./tempo";
import type { LoadedChart, Projectile } from "./types";

describe("aiming at you, shifted", () => {
  const ball = (): Projectile => ({ structure: "Ball", from: { x: 1, y: 1, z: 10 }, speed: 8 });

  it("writes an offset rounded, without parts that are 0, and the same again when read back", () => {
    const text = `{\n  "events": [\n    { "t": 1, "projectile": { "structure": "Ball", "from": { "x": 1, "y": 1, "z": 10 }, "speed": 8 } }\n  ]\n}`;
    const once = parse(text) as LoadedChart;
    setOffset(once.events[0].projectile!, { x: 0.504, y: 0 });
    const written = set(text, "events", once.events);
    expect(written).toMatch(/"offset": \{\s*"x": 0.5\s*\}/);
    expect(written).not.toMatch(/"y": 0\b/);
    const again = parse(written) as LoadedChart;
    expect(set(written, "events", again.events)).toBe(written);
  });

  it("leaves the offset out when both parts are 0", () => {
    const p = ball();
    setOffset(p, { x: 0.5, y: -0.25 });
    expect(p.offset).toEqual({ x: 0.5, y: -0.25 });
    setOffset(p, { x: 0 });
    expect(p.offset).toEqual({ y: -0.25 });
    setOffset(p, { y: 0.001 });
    expect(p).not.toHaveProperty("offset");
  });

  it("never keeps both a fixed point and an offset, whichever way the aim is switched", () => {
    const p = ball();
    setOffset(p, { x: 0.5 });
    setAimMode(p, "point");
    expect(p.offset).toBeUndefined();
    expect(p.to).toEqual({ x: 0, y: 1.3 });
    setAimMode(p, "player");
    expect(p.to).toBeUndefined();
    setOffset(p, { y: 1 });
    setAim(p, "straight");
    expect(p.offset).toBeUndefined();
    expect(p.to).toEqual({ x: 1, y: 1.3 });
  });

  it("aims at you, shifted across the lane and up, and mirrors across", () => {
    const p = { ...ball(), offset: { x: 0.5, y: 1 } };
    expect(aimPointOf(p)).toEqual({ x: 0.5, y: 2.35 });
    expect(aimPointOf(ball())).toEqual({ x: 0, y: 1.35 });
    mirror([{ t: 1, projectile: p }]);
    expect(p.offset).toEqual({ x: -0.5, y: 1 });
  });

  it("finds what the mod refuses, and warns where it ignores y", () => {
    const c = { events: [
      { t: 1, projectile: { ...ball(), to: { x: 0, y: 1 }, offset: { x: 1 } } },
      { t: 2, projectile: { ...ball(), offset: {} } },
      { t: 3, projectile: { ...ball(), structure: "RockCube", offset: { x: 0.2, y: 1 } } },
      { t: 4, projectile: { ...ball(), offset: { y: 1 } } },
    ] } as unknown as LoadedChart;
    expect(problems(c, new Tempo(undefined))).toEqual([
      "events[0].projectile.offset can't be used with to - to is a fixed point, offset is from you",
      "events[1].projectile.offset needs x or y",
    ]);
    expect(warnings(c)).toEqual(["events[2].projectile.offset.y is ignored: a grounded projectile slides on the floor, so only x applies"]);
  });
});

const disc = (x: number, speed = 11): Projectile => ({ structure: "Disc", from: { x, y: 1.4, z: 10 }, to: { x, y: 1.3 }, speed });

describe("editing several projectiles", () => {
  it("reads a value they share, or says they differ", () => {
    expect(shared([disc(0), disc(1)], p => p.speed)).toBe(11);
    expect(shared([disc(0), disc(1, 9)], p => p.speed)).toBe(MIXED);
    expect(shared([] as Projectile[], p => p.speed)).toBe(MIXED);
  });

  it("tells straight aims from aims at a point or the player", () => {
    expect(aimOf(disc(0.75))).toBe("straight");
    expect(aimOf({ ...disc(0), to: { x: 1, y: 1.3 } })).toBe("point");
    expect(aimOf({ ...disc(0), to: undefined })).toBe("player");
  });

  it("aims each straight down its own column, keeping its aim height", () => {
    const a = { ...disc(-1.5), to: undefined }, b: Projectile = { ...disc(0.75), to: { x: 0, y: 1.8 } };
    setAim(a, "straight");
    setAim(b, "straight");
    expect(a.to).toEqual({ x: -1.5, y: 1.3 });
    expect(b.to).toEqual({ x: 0.75, y: 1.8 });
    setAim(b, "player");
    expect(b).not.toHaveProperty("to");
  });
});
