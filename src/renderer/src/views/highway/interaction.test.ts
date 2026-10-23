import { describe, expect, it } from "vitest";
import type { HighwayView, Tile } from "./geometry";
import { scrubbedTime, shiftedColumn, tileDrag, whatAHighwayPressHits, whatAHighwayTapDoes } from "./interaction";

const view: HighwayView = { w: 500, h: 400, hitY: 320, pps: 100, time: 10 };
const placed: Tile[] = [{ i: 7, column: 0, t: 10, x: 14, y: 313, w: 72, h: 14 }];

describe("a press on the highway", () => {
  it("drags a tile it lands on, with any pointer", () => {
    expect(whatAHighwayPressHits(placed, 50, 320, "touch", false)).toEqual({ kind: "tiles", index: 7 });
    expect(whatAHighwayPressHits(placed, 50, 320, "mouse", true)).toEqual({ kind: "tiles", index: 7 });
  });

  it("box-selects empty space with a mouse (a click adds) or in Select mode, and waits with a finger", () => {
    expect(whatAHighwayPressHits(placed, 250, 100, "mouse", false)).toEqual({ kind: "box", clickAdds: true });
    expect(whatAHighwayPressHits(placed, 250, 100, "touch", true)).toEqual({ kind: "box", clickAdds: false });
    expect(whatAHighwayPressHits(placed, 250, 100, "touch", false)).toEqual({ kind: "wait" });
  });

  it("taps add in the column tapped, at that time - or first let go of the selection", () => {
    expect(whatAHighwayTapDoes(view, 5, 250, 220, false, false)).toEqual({ kind: "add", column: 2, seconds: 11 });
    expect(whatAHighwayTapDoes(view, 5, 250, 220, true, false)).toEqual({ kind: "let-go" });
    expect(whatAHighwayTapDoes(view, 5, 250, 220, true, true)).toMatchObject({ kind: "add" });
  });

  it("drags tiles later as they go up, by whole columns across, and keeps them on the highway", () => {
    expect(tileDrag(view, 5, 50, 320, 250, 220)).toEqual({ seconds: 1, columns: 2 });
    expect(shiftedColumn(3, 4, 5)).toBe(4);
    expect(shiftedColumn(1, -4, 5)).toBe(0);
  });

  it("scrubs to later times as the finger pulls down, never before the start", () => {
    expect(scrubbedTime(10, 100, 150, 100)).toBe(10.5);
    expect(scrubbedTime(0.1, 100, 0, 100)).toBe(0);
  });
});
