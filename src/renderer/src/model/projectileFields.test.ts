import { describe, expect, it } from "vitest";
import { fieldRows, fieldsFor, PROJECTILE_FIELDS, type ProjectileField } from "./projectileFields";
import type { ChartEvent, LoadedChart, Projectile } from "./types";

const shot = (p: Partial<Projectile> = {}): ChartEvent => ({ t: 1, projectile: { structure: "Ball", from: { x: 0.5, y: 1.4, z: 10 }, speed: 8, ...p } });
const ids = (fields: ProjectileField[]) => fields.map(f => f.id);
const field = (id: string) => PROJECTILE_FIELDS.find(f => f.id === id)!;
const chart = { events: [], actors: [{ id: "boss", name: "Boss" }, { id: "imp", name: "Imp" }] } as unknown as LoadedChart;

describe("a projectile's fields, for one or several", () => {
  it("are all there for one, with the aim's own fields for how it aims", () => {
    expect(ids(fieldsFor([shot()]))).toEqual(["structure", "fromX", "height", "fromZ", "grounded", "aim", "offsetX", "offsetY", "speed", "telegraph", "actor"]);
    expect(ids(fieldsFor([shot({ to: { x: 1, y: 1 } })]))).toContain("aimX");
  });

  it("leave out places across the lane for several, and a field that doesn't apply to every one", () => {
    const several = ids(fieldsFor([shot(), shot({ offset: { x: 0.5 } })]));
    expect(several).not.toContain("fromX");
    expect(several).toContain("offsetX");
    const mixedAims = ids(fieldsFor([shot(), shot({ to: { x: 1, y: 1 } })]));
    expect(mixedAims).not.toContain("offsetX");
    expect(mixedAims).not.toContain("aimY");
    expect(ids(fieldsFor([shot({ to: { x: 1, y: 1 } }), shot({ to: { x: 2, y: 1 } })]))).toEqual(expect.arrayContaining(["aimY"]));
  });

  it("lay out in rows", () => {
    expect(fieldRows(fieldsFor([shot()])).map(row => row.length)).toEqual([1, 3, 1, 3, 3]);
  });

  it("write as the inspectors always have: aims, offsets, grounded and who throws", () => {
    const e = shot();
    (field("offsetX") as Extract<ProjectileField, { kind: "number" }>).write(e.projectile!, 0.25);
    expect(e.projectile!.offset).toEqual({ x: 0.25 });
    const aim = field("aim") as Extract<ProjectileField, { kind: "choice" }>;
    aim.write(e, "straight", chart);
    expect(e.projectile!.to).toEqual({ x: 0.5, y: 1.3 });
    expect(e.projectile!.offset).toBeUndefined();
    expect(aim.read(e, chart)).toBe("straight");
    aim.write(e, "point", chart);
    expect(aim.read(e, chart)).toBe("point");
    aim.write(e, "player", chart);
    expect(e.projectile!.to).toBeUndefined();

    const grounded = field("grounded") as Extract<ProjectileField, { kind: "check" }>;
    grounded.write(e.projectile!, true);
    expect(e.projectile!.grounded).toBe(true);
    expect(field("height").fixed!(e.projectile!)).toBe("grounded");

    const actor = field("actor") as Extract<ProjectileField, { kind: "choice" }>;
    actor.write(e, "imp", chart);
    expect(e.actor).toBe("imp");
    actor.write(e, "boss", chart);
    expect(e).not.toHaveProperty("actor");
  });
});
