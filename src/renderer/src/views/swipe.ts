// Swipes on the phone layout's panels: dragging one away to close it, and swiping in from the left
// edge to open the menu. Plain classes fed with pointer positions, so they can be tested; the
// components wire them up (components/gestures.ts).

/** How far a finger moves before a press counts as a drag, and which way it is going is decided. */
export const LOCK_PIXELS = 10;

export type Axis = "x" | "y";
/** Which way along the axis a drag closes: +1 right or down, -1 left or up, 0 either way (a card flung aside). */
export type Toward = 1 | -1 | 0;

/** How far past halfway-ish a panel must be dragged to close when it isn't flung. */
const CLOSES_AFTER_SHARE = 0.35;
/** A flick this fast (pixels a millisecond) closes it even when it hasn't gone far... */
const FLING_SPEED = 0.4;
/** ...as long as it went this far, so a jitter isn't a fling. */
const FLING_LEAST_PIXELS = 16;
/** Dragged the wrong way, it moves only this much of the finger's way. */
const RESISTANCE = 0.2;
/** How much of the finger's recent movement counts for its speed. */
const SPEED_WINDOW_MS = 100;

/**
 * One finger dragging a panel to close it. Until it has moved `LOCK_PIXELS` it is undecided; then it
 * is a drag (moving mostly along the axis, the closing way) or not (scrolling, or going the other
 * way), for good.
 */
export class DismissDrag {
  locked: "drag" | "ignore" | null = null;
  /** How far the panel is moved along the axis, in pixels (signed). */
  offset = 0;
  private samples: { at: number; offset: number }[] = [];

  constructor(readonly axis: Axis, readonly toward: Toward, readonly x0: number, readonly y0: number) {}

  /** The finger moved here, at this time (ms). True while it is a drag: move the panel by `offset`. */
  move(x: number, y: number, at: number): boolean {
    const dx = x - this.x0, dy = y - this.y0;
    const along = this.axis === "x" ? dx : dy, across = this.axis === "x" ? dy : dx;
    if (!this.locked) {
      if (Math.hypot(dx, dy) < LOCK_PIXELS) return false;
      const closingWay = this.toward === 0 || Math.sign(along) === this.toward;
      this.locked = Math.abs(along) > Math.abs(across) && closingWay ? "drag" : "ignore";
    }
    if (this.locked !== "drag") return false;
    this.offset = this.toward === 0 || Math.sign(along) === this.toward ? along : along * RESISTANCE;
    this.samples.push({ at, offset: this.offset });
    while (this.samples.length > 2 && at - this.samples[0].at > SPEED_WINDOW_MS) this.samples.shift();
    return true;
  }

  /** Its speed along the axis lately, in pixels a millisecond (signed). */
  speed(): number {
    const first = this.samples[0], last = this.samples.at(-1);
    if (!first || !last || last.at <= first.at) return 0;
    return (last.offset - first.offset) / (last.at - first.at);
  }

  /** Lifted: whether the panel, `size` pixels along the axis, should close - dragged far enough, or flung. */
  closes(size: number): boolean {
    if (this.locked !== "drag") return false;
    const way = this.toward || Math.sign(this.offset) || Math.sign(this.speed());
    if (!way) return false;
    const distance = this.offset * way, speed = this.speed() * way;
    return distance > size * CLOSES_AFTER_SHARE || (speed > FLING_SPEED && distance > FLING_LEAST_PIXELS);
  }
}

/** How far right a finger from the edge must go to open the menu. */
const EDGE_OPENS_AFTER_PIXELS = 36;

/**
 * A finger that started at the left edge: it opens the menu once it has gone far enough right and
 * more across than up or down; it gives up if it goes mostly up or down, or back left.
 */
export class EdgeSwipe {
  constructor(readonly x0: number, readonly y0: number) {}

  move(x: number, y: number): "open" | "give-up" | "wait" {
    const dx = x - this.x0, dy = Math.abs(y - this.y0);
    if (dx < -LOCK_PIXELS || (dy > 2 * LOCK_PIXELS && dy > dx)) return "give-up";
    if (dx >= EDGE_OPENS_AFTER_PIXELS && dx > dy * 1.5) return "open";
    return "wait";
  }
}
