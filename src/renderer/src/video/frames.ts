// What one frame of a music video looks like, measured from its pixels (RGBA, as a canvas gives them):
// its colours, highlights and shadows, how hazy and vignetted it is, the tiny bright specks and soft
// bright blobs in it, and how much it moved and changed since the frame before. Colours are linear.
import type { Rgb } from "../model/looks";

/** The size frames are measured at: small enough to be quick, big enough to see specks. */
export const MEASURE_WIDTH = 160, MEASURE_HEIGHT = 90;

export const HUE_BINS = 24;

export type FrameFeatures = {
  /** Seconds into the video. */
  time: number;
  /** Mean brightness, and how much it varies (0 to 1). */
  luma: number; contrast: number;
  saturation: number;
  mean: Rgb;
  /** Saturated, bright colour by hue, each bin 15 degrees wide - how much of the frame is that hue. */
  hues: number[];
  /** The brightest 5% and darkest 10% of the frame. */
  highlight: Rgb; shadow: Rgb;
  /** How much of the frame is bright, and how much of that is in soft areas rather than thin lines. */
  brightShare: number; brightSoftness: number;
  /** The top fifth of the frame - the sky, or the far background - and how flat it is; the bottom third's contrast. */
  top: Rgb; topContrast: number; bottomContrast: number;
  /** How much brighter the middle is than the edges, and the edges' colour. */
  vignette: number; edge: Rgb;
  /** Tiny bright points: how many, how big (pixels), their colour, how many hues they have (0 to 1), and how many weren't there a frame ago. */
  specks: number; speckSize: number; speckColour: Rgb | null; speckHues: number; speckTurnover: number;
  /** Soft bright blobs, as bokeh makes: how many, and how fast they drift up (frame heights a second). */
  blobs: number; blobRise: number;
  /** How much the picture moved, how much its colours changed, and how much brighter it got, since the frame before. */
  motion: number; change: number; rise: number;
};

const LINEAR = Float32Array.from({ length: 256 }, (_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
const SPECK_RADIUS = 2, BLOB_BLOCK = 4, NEAR_PIXELS = 2;

function hueOf(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  if (d <= 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

const meanOf = (r: Float32Array, g: Float32Array, b: Float32Array, at: ArrayLike<number>): Rgb => {
  let sr = 0, sg = 0, sb = 0;
  for (let k = 0; k < at.length; k++) { const i = at[k]; sr += r[i]; sg += g[i]; sb += b[i]; }
  return at.length ? [sr / at.length, sg / at.length, sb / at.length] : [0, 0, 0];
};

type Point = { x: number; y: number };

/** Measures frames one after another; it remembers the last one, for motion and what changed. */
export class FrameMeasurer {
  readonly #w: number; readonly #h: number;
  #previousLuma: Float32Array | null = null;
  #previousHistogram: Float32Array | null = null;
  #previousSpecks: Point[] = [];
  #previousBlobs: Point[] = [];
  #previousTime = 0;
  #previousBrightness: number | null = null;

  constructor(width = MEASURE_WIDTH, height = MEASURE_HEIGHT) { this.#w = width; this.#h = height; }

  measure(rgba: ArrayLike<number>, time: number): FrameFeatures {
    const W = this.#w, H = this.#h, N = W * H;
    const r = new Float32Array(N), g = new Float32Array(N), b = new Float32Array(N), luma = new Float32Array(N);
    const hues = new Array<number>(HUE_BINS).fill(0), histogram = new Float32Array(64);
    let sum = 0, sumSquares = 0, saturation = 0, centre = 0, centreCount = 0, edgeCount = 0;
    const top: number[] = [], bottom: number[] = [], edge: number[] = [];
    for (let i = 0; i < N; i++) {
      const R = rgba[i * 4], G = rgba[i * 4 + 1], B = rgba[i * 4 + 2];
      const lr = LINEAR[R], lg = LINEAR[G], lb = LINEAR[B], y = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
      r[i] = lr; g[i] = lg; b[i] = lb; luma[i] = y;
      sum += y; sumSquares += y * y;
      const max = Math.max(R, G, B), s = max ? (max - Math.min(R, G, B)) / max : 0;
      saturation += s;
      hues[Math.floor(hueOf(R, G, B) / (360 / HUE_BINS)) % HUE_BINS] += s * (max / 255);
      histogram[(R >> 6) * 16 + (G >> 6) * 4 + (B >> 6)]++;
      const x = i % W, row = (i / W) | 0;
      if (row < H * 0.2) top.push(i);
      if (row >= H * 2 / 3) bottom.push(i);
      const dx = (x - W / 2) / (W / 2), dy = (row - H / 2) / (H / 2), d = dx * dx + dy * dy;
      if (d < 0.25) { centre += y; centreCount++; } else if (d > 0.8) { edge.push(i); edgeCount++; }
    }
    const lumaMean = sum / N, contrast = Math.sqrt(Math.max(0, sumSquares / N - lumaMean * lumaMean));
    const all = Array.from({ length: N }, (_, i) => i);
    const order = all.sort((p, q) => luma[p] - luma[q] || p - q);
    const contrastOf = (at: number[]) => {
      let s = 0, s2 = 0;
      for (const i of at) { s += luma[i]; s2 += luma[i] ** 2; }
      const m = s / at.length;
      return Math.sqrt(Math.max(0, s2 / at.length - m * m));
    };

    let bright = 0, softBright = 0;
    for (let i = 0; i < N; i++) {
      if (luma[i] <= 0.6) continue;
      bright++;
      const x = i % W, row = (i / W) | 0;
      if (x > 0 && x < W - 1 && row > 0 && row < H - 1 && luma[i - 1] > 0.6 && luma[i + 1] > 0.6 && luma[i - W] > 0.6 && luma[i + W] > 0.6) softBright++;
    }

    const specks = this.#specks(luma, r, g, b);
    const blobs = this.#blobs(luma);
    let motion = 0, change = 0;
    if (this.#previousLuma) for (let i = 0; i < N; i++) motion += Math.abs(luma[i] - this.#previousLuma[i]);
    if (this.#previousHistogram) for (let k = 0; k < 64; k++) {
      const p = histogram[k] / N, q = this.#previousHistogram[k] / N;
      if (p + q > 0) change += (p - q) ** 2 / (p + q);
    }
    const turnover = specks.points.length ? specks.points.filter(p => !this.#previousSpecks.some(q => Math.abs(p.x - q.x) <= NEAR_PIXELS && Math.abs(p.y - q.y) <= NEAR_PIXELS)).length / specks.points.length : 0;
    const rises = blobs.flatMap(p => {
      const nearest = this.#previousBlobs.reduce<Point | null>((best, q) => !best || Math.hypot(p.x - q.x, p.y - q.y) < Math.hypot(p.x - best.x, p.y - best.y) ? q : best, null);
      return nearest && Math.hypot(p.x - nearest.x, p.y - nearest.y) < BLOB_BLOCK * 3 ? [(nearest.y - p.y) / H / Math.max(1e-3, time - this.#previousTime)] : [];
    });
    const rise = this.#previousBrightness == null ? 0 : lumaMean - this.#previousBrightness;
    this.#previousLuma = luma; this.#previousHistogram = histogram; this.#previousSpecks = specks.points; this.#previousBlobs = blobs; this.#previousTime = time;
    this.#previousBrightness = lumaMean;

    return {
      time, luma: lumaMean, contrast, saturation: saturation / N, mean: meanOf(r, g, b, all), hues: hues.map(h => h / N),
      highlight: meanOf(r, g, b, order.slice(-Math.max(1, Math.round(N * 0.05)))), shadow: meanOf(r, g, b, order.slice(0, Math.max(1, Math.round(N * 0.1)))),
      brightShare: bright / N, brightSoftness: bright ? softBright / bright : 0,
      top: meanOf(r, g, b, top), topContrast: contrastOf(top), bottomContrast: contrastOf(bottom),
      vignette: centreCount && edgeCount ? centre / centreCount - edge.reduce((s, i) => s + luma[i], 0) / edgeCount : 0, edge: meanOf(r, g, b, edge),
      specks: specks.points.length, speckSize: specks.size, speckColour: specks.colour, speckHues: specks.hues, speckTurnover: turnover,
      blobs: blobs.length, blobRise: rises.length ? rises.reduce((s, v) => s + v, 0) / rises.length : 0,
      motion: motion / N, change, rise,
    };
  }

  // A speck is a pixel brighter than everything within two pixels of it, and well above their average.
  #specks(luma: Float32Array, r: Float32Array, g: Float32Array, b: Float32Array) {
    const W = this.#w, H = this.#h, points: Point[] = [], at: number[] = [], hueSet = new Set<number>();
    let size = 0;
    for (let y = SPECK_RADIUS; y < H - SPECK_RADIUS; y++) for (let x = SPECK_RADIUS; x < W - SPECK_RADIUS; x++) {
      const i = y * W + x, v = luma[i];
      if (v < 0.35) continue;
      let around = 0, highest = true;
      for (let oy = -SPECK_RADIUS; oy <= SPECK_RADIUS && highest; oy++) for (let ox = -SPECK_RADIUS; ox <= SPECK_RADIUS; ox++) {
        if (!ox && !oy) continue;
        const u = luma[i + oy * W + ox];
        // Ties go to the first pixel, so a flat bright patch isn't a speck at every pixel.
        if (u > v || (u === v && (oy < 0 || (oy === 0 && ox < 0)))) { highest = false; break; }
        around += u;
      }
      if (!highest || v <= around / 24 * 1.8 + 0.05) continue;
      points.push({ x, y }); at.push(i);
      let lit = 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (luma[i + oy * W + ox] > v * 0.6) lit++;
      size += lit;
      const max = Math.max(r[i], g[i], b[i]), min = Math.min(r[i], g[i], b[i]);
      if (max > 0 && (max - min) / max > 0.2) hueSet.add(Math.floor(hueOf(r[i], g[i], b[i]) / 30));
    }
    return { points, size: points.length ? size / points.length : 0, colour: points.length ? meanOf(r, g, b, at) : null, hues: points.length > 2 ? hueSet.size / 12 : 0 };
  }

  // Blobs: blocks of the frame, averaged, that are bright and brighter than the blocks around them.
  #blobs(luma: Float32Array): Point[] {
    const W = this.#w, bw = Math.floor(W / BLOB_BLOCK), bh = Math.floor(this.#h / BLOB_BLOCK), blocks = new Float32Array(bw * bh);
    for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
      let s = 0;
      for (let y = 0; y < BLOB_BLOCK; y++) for (let x = 0; x < BLOB_BLOCK; x++) s += luma[(by * BLOB_BLOCK + y) * W + bx * BLOB_BLOCK + x];
      blocks[by * bw + bx] = s / (BLOB_BLOCK * BLOB_BLOCK);
    }
    const out: Point[] = [];
    for (let by = 1; by < bh - 1; by++) for (let bx = 1; bx < bw - 1; bx++) {
      const v = blocks[by * bw + bx];
      if (v < 0.4) continue;
      let around = 0, highest = true;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue;
        const u = blocks[(by + oy) * bw + bx + ox];
        if (u > v || (u === v && (oy < 0 || (oy === 0 && ox < 0)))) highest = false;
        around += u;
      }
      if (highest && v > around / 8 * 1.5) out.push({ x: (bx + 0.5) * BLOB_BLOCK, y: (by + 0.5) * BLOB_BLOCK });
    }
    return out;
  }
}
