import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STRUCTURES } from "../model/constants";
import type { LoadedChart, Projectile } from "../model/types";
import { shotLegend, shotPaint, structureColourVariable } from "./shotColours";
import type { Theme } from "./theme";

// Each colour stands for its own name, so the tests can see which one was picked.
const t = new Proxy({}, { get: (_, name) => String(name) }) as Theme;
const shot = (structure: Projectile["structure"], grounded?: boolean): Projectile => ({ structure, from: { x: 0, y: 1, z: 10 }, ...(grounded == null ? {} : { grounded }) }) as Projectile;
const chartOf = (...shots: Projectile[]) => ({ events: shots.map((projectile, i) => ({ t: i, projectile })) }) as unknown as LoadedChart;

describe("projectile colours", () => {
  it("leaves the views' own colours alone in one colour", () => {
    expect(shotPaint(shot("Ball"), "plain", t)).toEqual({ colour: null, striped: false });
  });

  it("colours by structure, and stripes the grounded ones only when asked to", () => {
    expect(shotPaint(shot("Ball"), "structure", t)).toEqual({ colour: "shotBall", striped: false });
    expect(shotPaint(shot("Pillar"), "structure", t)).toEqual({ colour: "shotPillar", striped: false });
    expect(shotPaint(shot("Pillar"), "both", t)).toEqual({ colour: "shotPillar", striped: true });
    expect(shotPaint(shot("Pillar", false), "both", t)).toEqual({ colour: "shotPillar", striped: false });
    expect(shotPaint(shot("Disc", true), "both", t)).toEqual({ colour: "shotDisc", striped: true });
  });

  it("colours by grounded, with each structure's own default", () => {
    expect(shotPaint(shot("RockCube"), "grounded", t).colour).toBe("shotGrounded");
    expect(shotPaint(shot("Disc"), "grounded", t).colour).toBe("shotAirborne");
    expect(shotPaint(shot("Disc", true), "grounded", t).colour).toBe("shotGrounded");
  });

  it("has a colour in both themes for every structure", () => {
    const css = readFileSync(new URL("../app.css", import.meta.url), "utf8");
    for (const structure of STRUCTURES) {
      expect(css.match(new RegExp(`${structureColourVariable(structure)}:`, "g"))?.length).toBe(2);
    }
  });

  it("lists in the legend only what the chart throws", () => {
    const chart = chartOf(shot("Disc"), shot("Wall"), shot("Disc"));
    expect(shotLegend(chart, "plain")).toEqual([]);
    expect(shotLegend(chart, "structure").map(e => e.label)).toEqual(["Disc", "Wall"]);
    expect(shotLegend(chart, "both").map(e => e.label)).toEqual(["Disc", "Wall", "grounded"]);
    expect(shotLegend(chartOf(shot("Ball")), "both").map(e => e.label)).toEqual(["Ball"]);
    expect(shotLegend(chart, "grounded").map(e => e.label)).toEqual(["grounded", "in the air"]);
  });
});
