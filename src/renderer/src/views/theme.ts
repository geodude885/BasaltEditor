// The page's colours and fonts for canvas drawing, read once from the CSS variables in app.css.
import { createSubscriber } from "svelte/reactivity";

const NAMES = {
  text: "text", textDim: "text-dim", accent: "accent", wash: "wash", telegraph: "telegraph", move: "move", clip: "clip", look: "look",
  phase: "phase", bad: "bad", timeline: "timeline", grid: "grid", gridBeat: "grid-beat", gridBar: "grid-bar", wave: "wave",
  floor: "floor", laneFloor: "lane-floor", laneEnds: "lane-ends", zone: "zone", body: "body", mono: "mono",
  shotDisc: "shot-disc", shotBall: "shot-ball", shotPillar: "shot-pillar", shotWall: "shot-wall", shotRockCube: "shot-rock-cube",
  shotBoulderBall: "shot-boulder-ball", shotSmallRock: "shot-small-rock", shotLargeRock: "shot-large-rock",
  shotGrounded: "shot-grounded", shotAirborne: "shot-airborne",
} as const;

export type Theme = Record<keyof typeof NAMES, string>;

const cached = new Map<string, Theme>();

/**
 * Redraws once the page has finished loading. On the web, a canvas can draw before the stylesheet has
 * arrived; the colours read then are blank, so they are not kept, and the draw runs again when it has.
 */
const subscribeToLoading = createSubscriber(update => {
  if (document.readyState === "complete") return;
  window.addEventListener("load", update, { once: true });
  return () => window.removeEventListener("load", update);
});

/** The colours for a scheme ("dark" or "light"), once <html> carries it. Passing it makes a draw depend on it. */
export function theme(scheme: string): Theme {
  subscribeToLoading();
  let t = cached.get(scheme);
  if (t) return t;
  const style = getComputedStyle(document.documentElement);
  t = Object.fromEntries(Object.entries(NAMES).map(([key, name]) => [key, style.getPropertyValue(`--${name}`).trim()])) as Theme;
  // Keep only a full set: a blank colour means the stylesheet isn't in yet, and would stick.
  if (Object.values(t).every(Boolean)) cached.set(scheme, t);
  return t;
}

/** A #rrggbb colour at some opacity, for the canvas. */
export function alpha(colour: string, opacity: number): string {
  return colour + Math.round(Math.max(0, Math.min(1, opacity)) * 255).toString(16).padStart(2, "0");
}

/** Sizes a canvas's backing store to its laid-out size at the screen's pixel ratio, and returns a context drawing in CSS pixels. */
export function prepare(canvas: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1, bw = Math.max(1, Math.round(w * dpr)), bh = Math.max(1, Math.round(h * dpr));
  if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export type Box = { x0: number; y0: number; x1: number; y1: number };

/** A box normalised so x0 <= x1 and y0 <= y1. */
export const normalise = (b: Box): Box => ({ x0: Math.min(b.x0, b.x1), x1: Math.max(b.x0, b.x1), y0: Math.min(b.y0, b.y1), y1: Math.max(b.y0, b.y1) });

const BOX_SMALLER_THAN_THIS_IS_A_CLICK_PIXELS = 4;

export const boxIsAClick = (box: Box): boolean =>
  Math.abs(box.x1 - box.x0) < BOX_SMALLER_THAN_THIS_IS_A_CLICK_PIXELS && Math.abs(box.y1 - box.y0) < BOX_SMALLER_THAN_THIS_IS_A_CLICK_PIXELS;

export function drawBox(ctx: CanvasRenderingContext2D, b: Box, t: Theme): void {
  ctx.strokeStyle = t.text; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
  ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); ctx.setLineDash([]);
  ctx.fillStyle = alpha(t.wash, 0.06); ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
}
