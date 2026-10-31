import { describe, expect, it } from "vitest";
import { aimOf, MIXED, setAim, shared } from "./batch";
import type { Projectile } from "./types";

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
