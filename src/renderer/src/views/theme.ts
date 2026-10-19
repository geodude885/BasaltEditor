// The page's colours and fonts for canvas drawing, read once from the CSS variables in app.css.

export type Theme = Record<"ground" | "sand" | "dust" | "lane" | "telegraph" | "move" | "clip" | "look" | "phase" | "bad" | "body" | "mono", string>;

let cached: Theme | null = null;

export function theme(): Theme {
  if (cached) return cached;
  const style = getComputedStyle(document.documentElement), v = (name: string) => style.getPropertyValue(`--${name}`).trim();
  cached = {
    ground: v("ground"), sand: v("sand"), dust: v("dust"), lane: v("lane"), telegraph: v("telegraph"),
    move: v("move"), clip: v("clip"), look: v("look"), phase: v("phase"), bad: v("bad"), body: v("body"), mono: v("mono"),
  };
  return cached;
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
  ctx.strokeStyle = t.sand; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
  ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); ctx.setLineDash([]);
  ctx.fillStyle = "#ffffff10"; ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
}
