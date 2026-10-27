// How things move: one set of timings and the transitions the components use, so the app moves
// alike everywhere. Short on purpose - this is an editor, used fast - and things leave faster than
// they arrive. With the system's "reduce motion" on, slides become a quick fade.
//
// Use them as separate in: and out: directives (in:panel={...} out:panel={...}), not transition:,
// so each knows which way it is going. A leaving element ignores the pointer, so taps reach what is
// underneath at once. Canvases never animate: what's drawn follows the finger exactly.
import { cubicIn, cubicOut } from "svelte/easing";
import type { TransitionConfig } from "svelte/transition";

export const MOTION = {
  /** Arriving: long enough to see where it came from. */
  in: 180,
  /** Leaving: out of the way quickly. */
  out: 120,
  /** Small things: a menu dropping down, a row of buttons appearing. */
  quick: 120,
  /** What reduced motion does instead: a brief fade. */
  reduced: 100,
} as const;

export type Side = "left" | "right" | "top" | "bottom";
type Way = { direction: "in" | "out" | "both" };

export const reducedMotion = (): boolean =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function timing({ direction }: Way, inMs: number = MOTION.in, outMs: number = MOTION.out) {
  const leaving = direction === "out";
  return { leaving, duration: leaving ? outMs : inMs, easing: leaving ? cubicIn : cubicOut, block: leaving ? "pointer-events: none;" : "" };
}

/**
 * Leaving after being dragged away (components/gestures.ts leaves where the finger let go on the
 * element): carry on from there, off the way it was going, instead of jumping back to the start.
 * Null for anything not dragged.
 */
function flung(node: Element, way: Way, fade: boolean): TransitionConfig | null {
  const el = node as HTMLElement, axis = el.dataset.flungAxis;
  if (way.direction !== "out" || (axis !== "x" && axis !== "y")) return null;
  const from = parseFloat(el.dataset.flungPx ?? "0") || 0, size = axis === "x" ? el.offsetWidth : el.offsetHeight;
  const to = (Math.sign(from) || 1) * Math.max(size, Math.abs(from)), A = axis.toUpperCase();
  // Reduced motion: it stays where the finger left it and fades.
  if (reducedMotion()) return { duration: MOTION.reduced, css: t => `transform: translate${A}(${from}px); opacity: ${t}; pointer-events: none;` };
  return {
    duration: MOTION.out, easing: cubicOut,
    css: (t, u) => `transform: translate${A}(${from + (to - from) * u}px); ${fade ? `opacity: ${t};` : ""} pointer-events: none;`,
  };
}

/** Just a fade - for reduced motion, and for things that only appear (a scrim). */
export function veil(_node: Element, _params: object = {}, way: Way = { direction: "both" }): TransitionConfig {
  const { duration, easing, block } = timing(way);
  return { duration: reducedMotion() ? MOTION.reduced : duration, easing, css: t => `opacity: ${t}; ${block}` };
}

/** A panel sliding in from one side by its own size, and back out the same way: drawers and sheets. */
export function panel(node: Element, { from = "left" }: { from?: Side } = {}, way: Way = { direction: "both" }): TransitionConfig {
  const thrown = flung(node, way, false);
  if (thrown) return thrown;
  if (reducedMotion()) return veil(node, {}, way);
  const { duration, easing, block } = timing(way);
  const axis = from === "left" || from === "right" ? "X" : "Y", sign = from === "left" || from === "top" ? -1 : 1;
  return { duration, easing, css: (_t, u) => `transform: translate${axis}(${sign * u * 100}%); ${block}` };
}

/**
 * Something floating rising into place a little way, fading as it comes: cards, the toast, the
 * library. `from` is where it comes from, `distance` how far in pixels.
 */
export function rise(node: Element, { from = "bottom", distance = 12 }: { from?: Side; distance?: number } = {}, way: Way = { direction: "both" }): TransitionConfig {
  const thrown = flung(node, way, true);
  if (thrown) return thrown;
  if (reducedMotion()) return veil(node, {}, way);
  const { duration, easing, block } = timing(way);
  const axis = from === "left" || from === "right" ? "X" : "Y", sign = from === "left" || from === "top" ? -1 : 1;
  return { duration, easing, css: (t, u) => `opacity: ${t}; transform: translate${axis}(${sign * u * distance}px); ${block}` };
}

/** A menu dropping open: quick, and only a few pixels. Menus close at once, so use it as in: only. */
export function drop(node: Element, _params: object = {}, way: Way = { direction: "in" }): TransitionConfig {
  if (reducedMotion()) return veil(node, {}, way);
  const { easing, block } = timing(way);
  return { duration: MOTION.quick, easing, css: (t, u) => `opacity: ${t}; transform: translateY(${-u * 4}px); ${block}` };
}

/**
 * Something in a row or column opening up its space instead of jumping in: the recording pads, a
 * group of buttons. `axis` is the way it grows: "y" for height, "x" for width.
 */
export function grow(node: Element, { axis = "y" }: { axis?: "x" | "y" } = {}, way: Way = { direction: "both" }): TransitionConfig {
  if (reducedMotion()) return veil(node, {}, way);
  const { easing, block } = timing(way, MOTION.quick, MOTION.quick);
  const style = getComputedStyle(node), size = axis === "y" ? (node as HTMLElement).offsetHeight : (node as HTMLElement).offsetWidth;
  const [start, end] = axis === "y" ? ["top", "bottom"] : ["left", "right"];
  const dim = axis === "y" ? "height" : "width";
  const padStart = parseFloat(style.getPropertyValue(`padding-${start}`)), padEnd = parseFloat(style.getPropertyValue(`padding-${end}`));
  return {
    duration: MOTION.quick, easing,
    css: t => `overflow: hidden; opacity: ${Math.min(1, t * 2)}; ${dim}: ${t * size}px; padding-${start}: ${t * padStart}px; padding-${end}: ${t * padEnd}px; ${block}`,
  };
}
