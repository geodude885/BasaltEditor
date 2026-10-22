import { describe, expect, it } from "vitest";
import { Pinch, Taps } from "./touch";

const press = (pointerType: string, timeStamp: number, x = 0, detail = 0) => ({ pointerType, detail, timeStamp, clientX: x, clientY: 0 });

describe("Taps", () => {
  it("leaves a mouse to its own click count", () => {
    const taps = new Taps();
    expect(taps.isDouble(press("mouse", 0, 0, 1))).toBe(false);
    expect(taps.isDouble(press("mouse", 100, 0, 2))).toBe(true);
    expect(taps.isDouble(press("mouse", 120, 0, 1))).toBe(false);
  });

  it("times two quick taps in one spot as a double tap", () => {
    const taps = new Taps();
    expect(taps.isDouble(press("touch", 0))).toBe(false);
    expect(taps.isDouble(press("touch", 200, 5))).toBe(true);
    // The pair is used up: a third tap starts again.
    expect(taps.isDouble(press("touch", 300, 5))).toBe(false);
  });

  it("does not join slow or distant taps", () => {
    const taps = new Taps();
    taps.isDouble(press("touch", 0));
    expect(taps.isDouble(press("touch", 1000))).toBe(false);
    expect(taps.isDouble(press("touch", 1100, 200))).toBe(false);
  });
});

describe("Pinch", () => {
  it("starts on the second finger and zooms by the change in spread", () => {
    const pinch = new Pinch();
    expect(pinch.down(1, 100, 0)).toBe(false);
    expect(pinch.busy).toBe(false);
    expect(pinch.down(2, 200, 0)).toBe(true);
    expect(pinch.busy).toBe(true);
    const step = pinch.move(2, 300, 0)!;
    expect(step.zoom).toBeCloseTo(2);
    expect(step.atX).toBe(200);
    expect(step.panX).toBe(50);
  });

  it("pans when both fingers slide together", () => {
    const pinch = new Pinch();
    pinch.down(1, 100, 0);
    pinch.down(2, 200, 0);
    pinch.move(1, 140, 0);
    const step = pinch.move(2, 240, 0)!;
    expect(step.zoom).toBeCloseTo(100 / 60);
    expect(step.panX).toBe(20);
  });

  it("stays busy until every finger has lifted", () => {
    const pinch = new Pinch();
    pinch.down(1, 0, 0);
    pinch.down(2, 50, 0);
    pinch.up(2);
    expect(pinch.busy).toBe(true);
    expect(pinch.move(1, 10, 0)).toBeNull();
    pinch.up(1);
    expect(pinch.busy).toBe(false);
  });
});
