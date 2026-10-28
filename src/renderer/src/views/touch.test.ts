import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dragStartsAfterPixels, Fingers, LONG_PRESS_MS, Pinch, restingFinger, Taps, TwoFingerTap, WaitingPress } from "./touch";

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

describe("WaitingPress", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("becomes a long press when held still", () => {
    let held = 0;
    const press = new WaitingPress(10, 10, () => held++);
    expect(press.pans(13, 12)).toBe(false);
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(held).toBe(1);
  });

  it("becomes a pan once it moves far enough, and then never a long press", () => {
    let held = 0;
    const press = new WaitingPress(0, 0, () => held++);
    expect(press.pans(20, 0)).toBe(true);
    expect(press.pans(1, 0)).toBe(true);
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(held).toBe(0);
  });

  it("does nothing more once it ends", () => {
    let held = 0;
    new WaitingPress(0, 0, () => held++).end();
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(held).toBe(0);
  });
});

describe("TwoFingerTap", () => {
  it("is two fingers down and up quickly, without moving", () => {
    const tap = new TwoFingerTap();
    tap.down(1, 100, 100, 0);
    tap.down(2, 200, 100, 30);
    tap.move(1, 104, 102);
    expect(tap.up(1, 150)).toBe(false);
    expect(tap.up(2, 170)).toBe(true);
  });

  it("isn't a pinch, a slow rest, one finger or three", () => {
    const pinch = new TwoFingerTap();
    pinch.down(1, 100, 100, 0); pinch.down(2, 200, 100, 10);
    pinch.move(2, 260, 100);
    pinch.up(1, 100);
    expect(pinch.up(2, 120)).toBe(false);

    const slow = new TwoFingerTap();
    slow.down(1, 0, 0, 0); slow.down(2, 50, 0, 10);
    slow.up(1, 500);
    expect(slow.up(2, 520)).toBe(false);

    const one = new TwoFingerTap();
    one.down(1, 0, 0, 0);
    expect(one.up(1, 80)).toBe(false);

    const three = new TwoFingerTap();
    three.down(1, 0, 0, 0); three.down(2, 50, 0, 5); three.down(3, 90, 0, 10);
    three.up(1, 100); three.up(2, 110);
    expect(three.up(3, 120)).toBe(false);
  });

  it("starts afresh for the next tap, and a cancelled finger spoils it", () => {
    const tap = new TwoFingerTap();
    tap.down(1, 0, 0, 0); tap.down(2, 50, 0, 10);
    tap.up(1, 100, true);
    expect(tap.up(2, 120)).toBe(false);
    tap.down(3, 0, 0, 1000); tap.down(4, 50, 0, 1010);
    tap.up(3, 1100);
    expect(tap.up(4, 1120)).toBe(true);
  });
});

describe("dragStartsAfterPixels", () => {
  it("lets a fingertip wobble more than a mouse before it drags", () => {
    expect(dragStartsAfterPixels("mouse")).toBeLessThan(dragStartsAfterPixels("touch"));
    expect(dragStartsAfterPixels("pen")).toBe(dragStartsAfterPixels("touch"));
  });
});

describe("Fingers", () => {
  const ev = (pointerId: number, timeStamp: number, pointerType = "touch", type = "pointerup") => ({ pointerId, pointerType, timeStamp, type });

  it("leaves a mouse alone", () => {
    const fingers = new Fingers();
    expect(fingers.down(ev(1, 0, "mouse"), 0, 0)).toBe(false);
    expect(fingers.down(ev(2, 10, "mouse"), 50, 0)).toBe(false);
    expect(fingers.busy).toBe(false);
    expect(fingers.move(ev(2, 20, "mouse"), 90, 0)).toBeNull();
    expect(fingers.up(ev(1, 30, "mouse"))).toBe(false);
  });

  it("pinches along the axis time runs on", () => {
    const across = new Fingers("x"), down = new Fingers("y");
    for (const f of [across, down]) { f.down(ev(1, 0), 0, 100); f.down(ev(2, 10), 0, 200); }
    expect(across.busy).toBe(true);
    // Fingers spreading up and down: the highway zooms about their middle, which moved down; along x
    // their middle stayed put, so the timeline doesn't pan.
    expect(down.move(ev(2, 20), 0, 300)).toEqual({ zoom: 2, atX: 200, panX: 50 });
    expect(across.move(ev(2, 20), 0, 300)!.panX).toBe(0);
  });

  it("says when two fingers tapped together", () => {
    const fingers = new Fingers();
    expect(fingers.down(ev(1, 0), 100, 0)).toBe(false);
    expect(fingers.down(ev(2, 20), 200, 0)).toBe(true);
    expect(fingers.up(ev(1, 100))).toBe(false);
    expect(fingers.up(ev(2, 120))).toBe(true);
    expect(fingers.busy).toBe(false);
  });
});

describe("restingFinger", () => {
  it("waits for a long press with a finger only", () => {
    expect(restingFinger({ pointerType: "mouse" }, 0, 0, () => {})).toBeUndefined();
    const press = restingFinger({ pointerType: "touch" }, 0, 0, () => {});
    expect(press).toBeInstanceOf(WaitingPress);
    press!.end();
  });
});
