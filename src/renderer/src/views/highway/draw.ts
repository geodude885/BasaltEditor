// Draws the highway: columns, the song's waveform faintly behind, beat and bar lines, the tiles and
// the hit line. Colours come from views/theme.ts like the other canvases.
import { peakBetween } from "../../audio/peaks";
import type { Tempo } from "../../model/tempo";
import type { LoadedChart } from "../../model/types";
import type { Song } from "../../store/session.svelte";
import { shotPaint, stripePath, type ShotColouring } from "../shotColours";
import { alpha, drawBox, type Box, type Theme } from "../theme";
import { beatsBetween, columnSpan, timeOfY, yOfTime, type HighwayColumn, type HighwayView, type Tile } from "./geometry";

export type HighwayScene = {
  chart: LoadedChart;
  tempo: Tempo;
  view: HighwayView;
  columns: HighwayColumn[];
  tiles: Tile[];
  selection: ReadonlySet<number>;
  song: Song | null;
  songStart: number;
  box: Box | null;
  /** A loop's start and end in chart time, shaded, or null. */
  loop: readonly [number, number] | null;
  shotColouring: ShotColouring;
};

export function drawHighway(ctx: CanvasRenderingContext2D, s: HighwayScene, t: Theme): void {
  const v = s.view, count = s.columns.length;
  ctx.fillStyle = t.timeline;
  ctx.fillRect(0, 0, v.w, v.h);

  // Alternate columns slightly, so each reads as a lane.
  for (let i = 0; i < count; i++) {
    const [x, w] = columnSpan(v, count, i);
    if (i % 2) { ctx.fillStyle = alpha(t.wash, 0.035); ctx.fillRect(x, 0, w, v.h); }
    ctx.fillStyle = t.grid;
    ctx.fillRect(Math.round(x), 0, 1, v.h);
  }

  drawWave(ctx, s, t);

  if (s.loop) {
    const top = yOfTime(v, s.loop[1]), bottom = yOfTime(v, s.loop[0]);
    ctx.fillStyle = alpha(t.accent, 0.08);
    ctx.fillRect(0, top, v.w, bottom - top);
    ctx.fillStyle = t.accent;
    ctx.fillRect(0, Math.round(top), v.w, 2);
    ctx.fillRect(0, Math.round(bottom) - 1, v.w, 2);
  }

  for (const beat of beatsBetween(s.tempo, timeOfY(v, v.h), timeOfY(v, 0))) {
    ctx.fillStyle = beat.bar ? t.gridBar : t.gridBeat;
    ctx.fillRect(0, Math.round(yOfTime(v, beat.t)), v.w, beat.bar ? 2 : 1);
  }

  for (const tile of s.tiles) {
    const e = s.chart.events[tile.i], structure = e?.projectile?.structure ?? "Disc", selected = s.selection.has(tile.i);
    // The telegraph: a faint tail back towards the hit line, from when the projectile appears.
    const telegraph = +(e?.projectile?.telegraph ?? 0.5);
    if (telegraph > 0) {
      ctx.fillStyle = alpha(t.telegraph, 0.22);
      ctx.fillRect(tile.x + tile.w * 0.4, tile.y + tile.h / 2, tile.w * 0.2, Math.min(telegraph * v.pps, v.h));
    }
    const paint = shotPaint(e?.projectile, s.shotColouring, t);
    ctx.fillStyle = paint.colour ?? (structure === "Disc" ? t.accent : t.clip);
    roundRect(ctx, tile.x, tile.y, tile.w, tile.h, 4);
    ctx.fill();
    if (paint.striped) stripePath(ctx, t, { x: tile.x, y: tile.y, w: tile.w, h: tile.h });
    if (selected) {
      ctx.strokeStyle = t.text; ctx.lineWidth = 2;
      roundRect(ctx, tile.x - 2, tile.y - 2, tile.w + 4, tile.h + 4, 5);
      ctx.stroke();
    }
  }

  // The hit line: where the playhead is.
  ctx.fillStyle = t.accent;
  ctx.fillRect(0, Math.round(v.hitY) - 1, v.w, 3);

  if (s.box) drawBox(ctx, s.box, t);
}

function drawWave(ctx: CanvasRenderingContext2D, s: HighwayScene, t: Theme): void {
  const peaks = s.song?.peaks, v = s.view;
  if (!peaks) return;
  ctx.fillStyle = alpha(t.textDim, 0.12);
  const mid = v.w / 2, step = 3;
  for (let y = 0; y < v.h; y += step) {
    const a = timeOfY(v, y + step) + s.songStart, b = timeOfY(v, y) + s.songStart;
    if (b < 0) continue;
    const half = peakBetween(peaks, Math.max(0, a), b) * v.w * 0.45;
    if (half > 0.5) ctx.fillRect(mid - half, y, half * 2, step);
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}
