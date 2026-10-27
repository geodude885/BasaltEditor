import { describe, expect, it } from "vitest";
import { DismissDrag, EdgeSwipe, LOCK_PIXELS } from "./swipe";

describe("dragging a panel away", () => {
  it("waits until the finger has moved before deciding", () => {
    const drag = new DismissDrag("x", -1, 100, 100);
    expect(drag.move(100 - LOCK_PIXELS / 2, 100, 10)).toBe(false);
    expect(drag.locked).toBeNull();
  });

  it("follows a drag the closing way", () => {
    const drag = new DismissDrag("x", -1, 100, 100);
    expect(drag.move(80, 102, 20)).toBe(true);
    expect(drag.offset).toBe(-20);
  });

  it("leaves scrolling alone, for good", () => {
    const drag = new DismissDrag("x", -1, 100, 100);
    expect(drag.move(96, 130, 20)).toBe(false);
    expect(drag.locked).toBe("ignore");
    expect(drag.move(20, 130, 40)).toBe(false);
  });

  it("won't start the wrong way, and resists being pulled that way once dragging", () => {
    expect(new DismissDrag("y", 1, 0, 0).move(0, -30, 20)).toBe(false);
    const drag = new DismissDrag("y", 1, 0, 0);
    drag.move(0, 20, 20);
    drag.move(0, -50, 60);
    expect(drag.offset).toBeCloseTo(-10);
  });

  it("closes when dragged far enough", () => {
    const drag = new DismissDrag("x", -1, 300, 0);
    drag.move(250, 0, 0);
    drag.move(150, 0, 400);
    expect(drag.closes(300)).toBe(true);
  });

  it("closes when flung, even a short way, but not after a slow nudge", () => {
    const flung = new DismissDrag("x", -1, 300, 0);
    flung.move(285, 0, 0);
    flung.move(260, 0, 40);
    expect(flung.closes(300)).toBe(true);
    const nudged = new DismissDrag("x", -1, 300, 0);
    nudged.move(285, 0, 0);
    nudged.move(260, 0, 400);
    expect(nudged.closes(300)).toBe(false);
  });

  it("flings a card either way when it can go either way", () => {
    const right = new DismissDrag("x", 0, 0, 0);
    right.move(30, 0, 0);
    right.move(90, 0, 40);
    expect(right.offset).toBe(90);
    expect(right.closes(200)).toBe(true);
    const left = new DismissDrag("x", 0, 0, 0);
    left.move(-30, 0, 0);
    left.move(-90, 0, 40);
    expect(left.closes(200)).toBe(true);
  });
});

describe("swiping in from the edge", () => {
  it("opens once far enough across", () => {
    const swipe = new EdgeSwipe(4, 200);
    expect(swipe.move(20, 204)).toBe("wait");
    expect(swipe.move(50, 210)).toBe("open");
  });

  it("gives up going up or down, or back", () => {
    expect(new EdgeSwipe(4, 200).move(10, 240)).toBe("give-up");
    expect(new EdgeSwipe(30, 200).move(10, 200)).toBe("give-up");
  });
});
