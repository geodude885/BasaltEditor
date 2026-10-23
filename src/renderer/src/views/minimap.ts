// The minimap beside the highway: the whole chart in a strip, the start at the bottom as on the
// highway - a tick for each projectile, the loop shaded, the playhead as a line.
import { evTime } from "../model/chart";
import type { Tempo } from "../model/tempo";
import type { LoadedChart } from "../model/types";
import { alpha, type Theme } from "./theme";

export type MinimapScene = { chart: LoadedChart; tempo: Tempo; length: number; time: number; loop: readonly [number, number] | null };

/** How far down the strip a moment is: the start at the bottom, `length` seconds at the top. */
export const minimapY = (h: number, length: number, t: number): number => h - (t / length) * h;

/** The moment at a point down the strip, kept within the chart. */
export const minimapTime = (h: number, length: number, y: number): number => Math.max(0, Math.min(length, (1 - y / h) * length));

export function drawMinimap(ctx: CanvasRenderingContext2D, w: number, h: number, s: MinimapScene, t: Theme): void {
  const y = (time: number) => minimapY(h, s.length, time);
  ctx.fillStyle = t.timeline;
  ctx.fillRect(0, 0, w, h);
  if (s.loop) {
    const top = y(s.loop[1]);
    ctx.fillStyle = alpha(t.accent, 0.2);
    ctx.fillRect(0, top, w, y(s.loop[0]) - top);
  }
  ctx.fillStyle = alpha(t.text, 0.55);
  for (const e of s.chart.events) {
    if (!e.projectile) continue;
    const at = evTime(e, s.tempo);
    if (Number.isFinite(at)) ctx.fillRect(2, Math.round(y(at)), w - 4, 1);
  }
  ctx.fillStyle = t.accent;
  ctx.fillRect(0, Math.round(y(Math.max(0, s.time))) - 1, w, 3);
}
