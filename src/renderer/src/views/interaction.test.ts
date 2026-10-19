import { describe, expect, it } from "vitest";
import * as Jsonc from "../model/jsonc";
import { SAMPLE } from "../model/samples";
import { Tempo } from "../model/tempo";
import type { LoadedChart } from "../model/types";
import { laneMap } from "./lane/geometry";
import { moveProjectilePoint, projectilesStartingInBox, whatALanePressHits } from "./lane/interaction";
import { boxIsAClick } from "./theme";
import { COLLAPSED_ROW_HEIGHT_PIXELS, layoutTimeline, markers, xOf, type TimelineRow } from "./timeline/geometry";
import { markersInBox, phaseIndexAt, whatATimelinePressHits } from "./timeline/interaction";

const sample = () => { const c = Jsonc.parse(SAMPLE) as LoadedChart; c.events ??= []; return c; };
const tempo = new Tempo(120);

describe("pressing on the lane", () => {
  const chart = sample(), map = laneMap(300, 400, { length: 12, width: 3 });
  const [firstShotX, firstShotY] = map.toPx(-1.5, 10);

  it("grabs a selected projectile's start", () => {
    expect(whatALanePressHits(chart, tempo, 0, [0], map, firstShotX + 3, firstShotY, false)).toEqual({ kind: "drag-projectile-point", index: 0, point: "from" });
  });

  it("selects what is under the pointer, nearest the playhead first", () => {
    const [x, y] = map.toPx(-1.2, 10);
    const press = whatALanePressHits(chart, tempo, 12, [], map, x, y, false);
    expect(press.kind).toBe("select-projectile");
    if (press.kind === "select-projectile") expect(chart.events[press.underPointer[0]].t).toBe(12);
  });

  it("adds a projectile on an empty floor when asked, kept on the lane", () => {
    const [x, y] = map.toPx(0.4, 15);
    expect(whatALanePressHits(chart, tempo, 0, [], map, x, y, true)).toEqual({ kind: "add-projectile", at: { x: 0.4, z: 12 } });
    expect(whatALanePressHits(chart, tempo, 0, [], map, x, y, false)).toEqual({ kind: "box-select" });
  });

  it("box-selects by where projectiles start", () => {
    const [x0, y0] = map.toPx(-2, 11), [x1, y1] = map.toPx(-1, 9);
    expect(projectilesStartingInBox(chart, map, { x0: x1, y0: y1, x1: x0, y1: y0 }).map(i => chart.events[i].t)).toEqual([2, 7, 11, 12, 27]);
  });

  it("drags a start along the lane and an aim past its sides", () => {
    const c = sample();
    moveProjectilePoint(c, map, 0, "from", ...map.toPx(9, -3));
    expect(c.events[0].projectile!.from).toMatchObject({ x: 3.5, z: 0.5 });
    moveProjectilePoint(c, map, 0, "to", ...map.toPx(-2.94, 0));
    expect(c.events[0].projectile!.to).toMatchObject({ x: -2.9 });
  });

  it("treats a tiny box as a click", () => {
    expect(boxIsAClick({ x0: 10, y0: 10, x1: 12, y1: 13 })).toBe(true);
    expect(boxIsAClick({ x0: 10, y0: 10, x1: 20, y1: 10 })).toBe(false);
  });
});

describe("pressing on the timeline", () => {
  const chart = sample(), view = { t0: 0, pps: 50 }, layout = layoutTimeline(new Set(), 0), placed = markers(chart, tempo, view, layout);
  const look = [{ index: 0, time: 4, pack: "BossBattles Stage", set: [], off: false, fade: 0 }];
  const press = (x: number, y: number, doubleClick = false) => whatATimelinePressHits(chart, tempo, view, layout, placed, look, x, y, doubleClick);
  const middleOf = (row: TimelineRow) => layout.rows[row][0] + layout.rows[row][1] / 2;

  it("seeks from the ruler and waveform", () => {
    expect(press(100, 5)).toEqual({ kind: "seek" });
    expect(press(100, middleOf("wave"))).toEqual({ kind: "seek" });
  });

  it("selects the phase under the pointer", () => {
    expect(press(xOf(view, 20), middleOf("phase"))).toEqual({ kind: "select-phase", index: 1 });
    expect(phaseIndexAt(chart, tempo, 30)).toBe(2);
  });

  it("selects a look cue near the pointer, else adds one on double-click", () => {
    expect(press(xOf(view, 4) + 5, middleOf("look"))).toEqual({ kind: "select-look-cue", index: 0 });
    expect(press(xOf(view, 9), middleOf("look"), true)).toEqual({ kind: "add-look-cue" });
    expect(press(xOf(view, 9), middleOf("look"))).toEqual({ kind: "seek" });
  });

  it("selects events by their markers, and adds or box-selects on empty rows", () => {
    const first = placed.find(m => m.i === 0)!;
    expect(press(first.x, first.y)).toEqual({ kind: "select-events", underPointer: [0] });
    expect(press(xOf(view, 1), middleOf("shot"), true)).toEqual({ kind: "add-projectile" });
    expect(press(xOf(view, 1), middleOf("move"), true)).toEqual({ kind: "add-move" });
    expect(press(xOf(view, 1), middleOf("move"))).toEqual({ kind: "box-select" });
    expect(press(xOf(view, 1), middleOf("clip"))).toEqual({ kind: "seek-and-clear-selection" });
  });

  it("box-selects markers", () => {
    const [shotTop, shotHeight] = layout.rows.shot;
    const inBox = markersInBox(placed, { x0: xOf(view, 6.9), y0: shotTop, x1: xOf(view, 7.5), y1: shotTop + shotHeight });
    expect(inBox.map(i => chart.events[i].t)).toEqual([7, 7.4]);
  });
});

describe("laying out the timeline", () => {
  it("stacks the rows with no gaps, at their own heights", () => {
    const layout = layoutTimeline(new Set(), 0);
    expect(layout.rows.ruler).toEqual([0, 22]);
    expect(layout.rows.look).toEqual([102, 34]);
    expect(layout.height).toBe(246);
  });

  it("shrinks a collapsed row to a strip and moves the rest up", () => {
    const layout = layoutTimeline(new Set<TimelineRow>(["wave", "look"]), 0);
    expect(layout.rows.wave).toEqual([22, COLLAPSED_ROW_HEIGHT_PIXELS]);
    expect(layout.rows.phase[0]).toBe(22 + COLLAPSED_ROW_HEIGHT_PIXELS);
    expect(layout.height).toBe(246 - 58 - 34 + 2 * COLLAPSED_ROW_HEIGHT_PIXELS);
  });

  it("gives extra height to the expanded rows that use it", () => {
    const taller = layoutTimeline(new Set(), 100), withLooksCollapsed = layoutTimeline(new Set<TimelineRow>(["look"]), 100);
    expect(taller.height).toBe(346);
    expect([taller.rows.wave[1], taller.rows.look[1], taller.rows.shot[1], taller.rows.move[1]]).toEqual([58 + 35, 34 + 20, 46 + 45, 34]);
    expect(withLooksCollapsed.rows.look[1]).toBe(COLLAPSED_ROW_HEIGHT_PIXELS);
    expect(withLooksCollapsed.height).toBe(246 - 34 + COLLAPSED_ROW_HEIGHT_PIXELS + 100);
  });

  it("puts every projectile on one line in a collapsed projectile row", () => {
    const layout = layoutTimeline(new Set<TimelineRow>(["shot"]), 0), [top, height] = layout.rows.shot;
    const shots = markers(sample(), tempo, { t0: 0, pps: 50 }, layout).filter(m => sample().events[m.i].projectile);
    expect(new Set(shots.map(m => m.y))).toEqual(new Set([top + height / 2]));
  });
});
