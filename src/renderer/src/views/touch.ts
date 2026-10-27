// Touch on the canvases: double taps, two-finger pinch and pan, and presses on empty space that wait
// to become a tap, a pan or a long press. A mouse never reaches the parts that differ, so the desktop
// behaves exactly as before.

type Press = { pointerType: string; detail: number; timeStamp: number; clientX: number; clientY: number };

const DOUBLE_TAP_MS = 350;
const DOUBLE_TAP_PIXELS = 24;

/**
 * Double clicks and double taps. A mouse's own click count decides for a mouse; touch and pens don't
 * count presses reliably in every browser, so those are timed here.
 */
export class Taps {
  private last: { at: number; x: number; y: number } | null = null;

  isDouble(ev: Press): boolean {
    if (ev.pointerType === "mouse") return ev.detail === 2;
    const l = this.last;
    const double = !!l && ev.timeStamp - l.at < DOUBLE_TAP_MS && Math.hypot(ev.clientX - l.x, ev.clientY - l.y) < DOUBLE_TAP_PIXELS;
    this.last = double ? null : { at: ev.timeStamp, x: ev.clientX, y: ev.clientY };
    return double;
  }
}

/** One step of a two-finger gesture: zoom by this factor about atX, after panning the content by panX pixels. */
export type PinchStep = { zoom: number; atX: number; panX: number };

const SMALLEST_SPAN_PIXELS = 10;

/**
 * Two fingers on a canvas. Feed it touch pointers only (in canvas pixels). While it is busy - two
 * fingers down, or one left over from a pinch - presses belong to the gesture, not to editing.
 */
export class Pinch {
  private points = new Map<number, { x: number; y: number }>();
  private last: { mid: number; span: number } | null = null;
  private lingering = false;

  get busy(): boolean { return this.points.size >= 2 || this.lingering; }

  /** A finger goes down. True when it starts a pinch, so the press it interrupts should be dropped. */
  down(id: number, x: number, y: number): boolean {
    this.points.set(id, { x, y });
    if (this.points.size !== 2) return false;
    this.last = this.measure();
    this.lingering = true;
    return true;
  }

  /** A finger moves. The step to apply while pinching, else null. */
  move(id: number, x: number, y: number): PinchStep | null {
    if (!this.points.has(id)) return null;
    this.points.set(id, { x, y });
    if (this.points.size < 2 || !this.last) return null;
    const now = this.measure(), was = this.last;
    this.last = now;
    return { zoom: was.span >= SMALLEST_SPAN_PIXELS ? now.span / was.span : 1, atX: now.mid, panX: now.mid - was.mid };
  }

  /** A finger lifts (or the browser cancels it). */
  up(id: number): void {
    this.points.delete(id);
    if (this.points.size < 2) this.last = null;
    if (this.points.size === 0) this.lingering = false;
  }

  private measure(): { mid: number; span: number } {
    const [a, b] = [...this.points.values()];
    return { mid: (a.x + b.x) / 2, span: Math.max(SMALLEST_SPAN_PIXELS, Math.hypot(a.x - b.x, a.y - b.y)) };
  }
}

/** How far a resting fingertip wobbles: a finger moving less than this hasn't moved. */
const FINGER_SLOP_PIXELS = 8;
/** How far a mouse moves before a press is a drag: it doesn't wobble. */
const MOUSE_SLOP_PIXELS = 3;

/**
 * How far a press must move before it drags what it pressed (markers, tiles). Every canvas uses
 * this, so a finger resting on something - to long-press it, say - doesn't nudge it.
 */
export const dragStartsAfterPixels = (pointerType: string): number => pointerType === "mouse" ? MOUSE_SLOP_PIXELS : FINGER_SLOP_PIXELS;

/** How far a finger on empty space moves before its press becomes a pan. */
export const TOUCH_PAN_STARTS_AFTER_PIXELS = FINGER_SLOP_PIXELS;
/** How long a finger is held still before its press becomes a long press. */
export const LONG_PRESS_MS = 450;

/**
 * A finger on empty space, waiting to see what its press becomes: moved far enough, a pan; held still,
 * a long press (`onHold`, which the timeline and highway make a selection box); lifted before either,
 * a tap. The canvases share it, so a press means the same on both.
 */
export class WaitingPress {
  /** Moved far enough to be a pan - from then on, never a tap or a long press. */
  panning = false;
  private timer: ReturnType<typeof setTimeout>;

  constructor(readonly x0: number, readonly y0: number, onHold: () => void) {
    this.timer = setTimeout(() => {
      if (this.panning) return;
      globalThis.navigator?.vibrate?.(12);
      onHold();
    }, LONG_PRESS_MS);
  }

  /** The finger moved here: true once the press is a pan. */
  pans(x: number, y: number): boolean {
    if (!this.panning && Math.hypot(x - this.x0, y - this.y0) < TOUCH_PAN_STARTS_AFTER_PIXELS) return false;
    if (!this.panning) { this.panning = true; clearTimeout(this.timer); }
    return true;
  }

  /** The press is over, one way or another: no long press after this. */
  end(): void {
    clearTimeout(this.timer);
  }
}

/** How quickly a two-finger tap's fingers must both land and lift, in milliseconds. */
const TWO_FINGER_TAP_MS = 300;
/** How far either finger may move and still be tapping. */
const TWO_FINGER_TAP_PIXELS = 12;

/**
 * Two fingers tapping together - undo, as in drawing apps. Exactly two fingers, both down and up
 * quickly, neither moving: a pinch moves, and resting fingers take too long.
 */
export class TwoFingerTap {
  private fingers = new Map<number, { x: number; y: number }>();
  private began = 0;
  private count = 0;
  private spoiled = false;

  down(id: number, x: number, y: number, at: number): void {
    if (!this.fingers.size) { this.began = at; this.count = 0; this.spoiled = false; }
    this.fingers.set(id, { x, y });
    if (++this.count > 2) this.spoiled = true;
  }

  move(id: number, x: number, y: number): void {
    const f = this.fingers.get(id);
    if (f && Math.hypot(x - f.x, y - f.y) > TWO_FINGER_TAP_PIXELS) this.spoiled = true;
  }

  /** A finger lifted (or the browser took it). True when that ends a two-finger tap. */
  up(id: number, at: number, cancelled = false): boolean {
    if (!this.fingers.delete(id)) return false;
    if (cancelled) this.spoiled = true;
    if (this.fingers.size) return false;
    return !this.spoiled && this.count === 2 && at - this.began <= TWO_FINGER_TAP_MS;
  }
}
