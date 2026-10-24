import { peakBetween } from "../../audio/peaks";
import { endOf, evTime, phaseTime } from "../../model/chart";
import { STAGE_PACK, stageLookAt, stagePreview, type TimedLookCue } from "../../model/looks";
import type { Tempo } from "../../model/tempo";
import type { LoadedChart } from "../../model/types";
import type { ClipSpan } from "../../io/files";
import type { Song } from "../../store/editor.svelte";
import { shotPaint, stripePath, type ShotColouring } from "../shotColours";
import { alpha, drawBox, type Box, type Theme } from "../theme";
import { tOf, xOf, type Marker, type TimelineLayout, type View } from "./geometry";

export type TimelineScene = {
  chart: LoadedChart;
  tempo: Tempo;
  view: View;
  time: number;
  snap: number;
  selection: ReadonlySet<number>;
  selectedPhase: number;
  lookCues: TimedLookCue[];
  selectedLookCue: number;
  markers: Marker[];
  song: Song | null;
  /** Where the chart starts in the song. */
  songStart: number;
  clips: Map<string, ClipSpan>;
  box: Box | null;
  layout: TimelineLayout;
  /** The A-B loop, shaded, or null. */
  loop: readonly [number, number] | null;
  /** A loop's first point while the second isn't set yet, or null. */
  loopStart: number | null;
  shotColouring: ShotColouring;
};

export function drawTimeline(ctx: CanvasRenderingContext2D, w: number, h: number, s: TimelineScene, t: Theme): void {
  const { chart: c, tempo: tp, view } = s, x = (time: number) => xOf(view, time), end = endOf(c, tp);
  const rows = s.layout.rows, collapsed = s.layout.collapsed, rulerBottom = rows.ruler[1];
  ctx.fillStyle = t.timeline; ctx.fillRect(0, 0, w, h);
  const t0 = view.t0, t1 = tOf(view, w);
  ctx.font = `10px ${t.mono}`;

  // Beats and bars, else seconds.
  if (tp.ok) {
    const b0 = Math.floor(tp.beat(Math.max(0, t0))), b1 = Math.ceil(tp.beat(Math.max(0, t1)));
    const sub = s.snap && view.pps * 60 / tp.bpmAt(Math.max(0, t0)) * s.snap > 10 ? s.snap : 1;
    for (let b = b0; b <= b1; b += sub) {
      const bx = x(tp.seconds(b)), bar = b % 4 === 0, whole = Number.isInteger(b);
      ctx.fillStyle = bar ? t.gridBar : whole ? t.gridBeat : t.grid;
      ctx.fillRect(bx, rulerBottom, 1, h - rulerBottom);
      if (bar) { ctx.fillStyle = t.textDim; ctx.textAlign = "left"; ctx.fillText(`${b / 4 + 1}`, bx + 3, 14); }
    }
  } else {
    for (let sec = Math.max(0, Math.floor(t0)); sec <= t1; sec++) {
      const sx = x(sec);
      ctx.fillStyle = t.gridBeat; ctx.fillRect(sx, rulerBottom, 1, h);
      ctx.fillStyle = t.textDim; ctx.textAlign = "left"; ctx.fillText(`${sec}s`, sx + 3, 14);
    }
  }
  // Tempo changes.
  if (Array.isArray(c.bpm)) {
    for (const change of tp.changes) {
      const cx = x(tp.seconds(change.beat));
      ctx.fillStyle = t.telegraph; ctx.fillText(`♩${change.bpm}`, cx + 3, 14); ctx.fillRect(cx, 0, 2, 22);
    }
  }

  drawWave(ctx, w, s, t);
  drawLoop(ctx, h, s, t);

  // Row bands.
  ctx.fillStyle = alpha(t.wash, 0.03);
  for (const k of ["phase", "move"] as const) ctx.fillRect(0, rows[k][0], w, rows[k][1]);

  // Phases.
  const phases = c.phases ?? [];
  phases.forEach((p, i) => {
    const a = x(phaseTime(p, tp)), b = x(i + 1 < phases.length ? phaseTime(phases[i + 1], tp) : end);
    ctx.fillStyle = alpha(t.phase, i === s.selectedPhase ? 0.33 : i % 2 ? 0.13 : 0.2);
    ctx.fillRect(a, rows.phase[0] + 2, b - a - 1, rows.phase[1] - 4);
    if (collapsed.has("phase")) return;
    ctx.fillStyle = t.phase; ctx.textAlign = "left";
    ctx.fillText(`${p.name || "Phase " + (i + 1)}${p.scoreMultiplier && p.scoreMultiplier !== 1 ? " ×" + p.scoreMultiplier : ""}`, a + 4, rows.phase[0] + 15);
  });

  drawLooks(ctx, w, s, t);

  // Events, where the markers put them - smaller, and without names, in a collapsed row.
  for (const { i, x: mx, y } of s.markers) {
    const e = c.events[i], sel = s.selection.has(i);
    if (e.projectile) {
      const r = collapsed.has("shot") ? 4 : 7;
      const spawn = evTime(e, tp) - (e.projectile.telegraph ?? 0.5);
      ctx.fillStyle = alpha(t.telegraph, 0.33); ctx.fillRect(x(spawn), y - 2, mx - x(spawn), 4);
      // Coloured by what it is, a selected one keeps its colour and is ringed instead.
      const paint = shotPaint(e.projectile, s.shotColouring, t);
      ctx.fillStyle = paint.colour ?? (sel ? t.text : t.accent);
      ctx.beginPath(); ctx.moveTo(mx, y - r); ctx.lineTo(mx + r - 1, y); ctx.lineTo(mx, y + r); ctx.lineTo(mx - r + 1, y); ctx.closePath(); ctx.fill();
      if (paint.striped) stripePath(ctx, t, { x: mx - r, y: y - r, w: r * 2, h: r * 2 });
      if (sel) { ctx.strokeStyle = paint.colour ? t.text : t.accent; ctx.lineWidth = 2; ctx.stroke(); }
    } else {
      const r = collapsed.has("move") ? 4 : 6;
      ctx.fillStyle = sel ? t.text : (e.at ? t.phase : t.move);
      if (e.at) ctx.fillRect(mx - r + 1, y - r + 1, (r - 1) * 2, (r - 1) * 2);
      else { ctx.beginPath(); ctx.moveTo(mx - r, y + r); ctx.lineTo(mx, y - r - 1); ctx.lineTo(mx + r, y + r); ctx.fill(); }
      if (collapsed.has("move")) continue;
      ctx.textAlign = "left"; ctx.fillStyle = t.textDim;
      ctx.fillText(e.move ?? (e.at ? `→ ${e.at.x}, ${e.at.z}` : "?"), mx + 8, y + 4);
    }
  }

  if (s.box) drawBox(ctx, s.box, t);

  // Recorded clips (made in game - shown, kept, not edited here).
  for (const track of c.tracks ?? []) {
    const clips = track.clips ?? [];
    clips.forEach((k, i) => {
      const start = k.t ?? (tp.ok && k.beat != null ? tp.seconds(k.beat) : 0);
      const next = i + 1 < clips.length ? (clips[i + 1].t ?? 0) : null;
      const recording = s.clips.get(k.clip);
      let stop = k.to != null ? start + (k.to - (k.from ?? 0)) : (recording ? start + (recording.end - (k.from ?? 0)) : end);
      if (next != null) stop = Math.min(stop, next);
      const inset = collapsed.has("clip") ? 2 : 4;
      ctx.fillStyle = alpha(t.clip, 0.2); ctx.fillRect(x(start), rows.clip[0] + inset, x(stop) - x(start) - 1, rows.clip[1] - inset * 2);
      if (!collapsed.has("clip")) { ctx.fillStyle = t.clip; ctx.textAlign = "left"; ctx.fillText(k.clip, x(start) + 4, rows.clip[0] + 19); }
    });
  }

  // End and playhead.
  ctx.fillStyle = t.bad; ctx.fillRect(x(end), rulerBottom, 2, h);
  ctx.fillStyle = t.text; ctx.fillRect(x(s.time), 0, 2, h);
}

/** The A-B loop as a shaded span with edges, or just its first point while the second isn't set. */
function drawLoop(ctx: CanvasRenderingContext2D, h: number, s: TimelineScene, t: Theme): void {
  const x = (time: number) => xOf(s.view, time);
  ctx.fillStyle = t.accent;
  if (s.loop) {
    const a = x(s.loop[0]), b = x(s.loop[1]);
    ctx.fillRect(a, 0, 2, h); ctx.fillRect(b - 1, 0, 2, h);
    ctx.fillStyle = alpha(t.accent, 0.08); ctx.fillRect(a, 0, b - a, h);
  } else if (s.loopStart != null) {
    ctx.fillRect(x(s.loopStart), 0, 2, h);
  }
}

/** The song's waveform, lined up with chart time (song time - music.start). */
function drawWave(ctx: CanvasRenderingContext2D, w: number, s: TimelineScene, t: Theme): void {
  const [y0, hh] = s.layout.rows.wave, mid = y0 + hh / 2;
  ctx.fillStyle = alpha(t.wash, 0.025); ctx.fillRect(0, y0, w, hh);
  const buffer = s.song?.buffer, peaks = s.song?.peaks;
  if (!buffer || !peaks) {
    if (s.layout.collapsed.has("wave")) return;
    ctx.fillStyle = t.textDim; ctx.textAlign = "left"; ctx.font = `12px ${t.body}`;
    const file = s.chart.music?.file;
    ctx.fillText(file ? `Open ${file} to see and hear it` : "No song. Add one in the Chart tab", 8, mid + 4);
    ctx.font = `10px ${t.mono}`;
    return;
  }
  ctx.fillStyle = t.wave;
  for (let px = 0; px < w; px++) {
    const a = tOf(s.view, px) + s.songStart, b = tOf(s.view, px + 1) + s.songStart;
    if (b < 0 || a > buffer.duration) continue;
    const height = Math.max(1, peakBetween(peaks, a, b) * (hh - 4));
    ctx.fillRect(px, mid - height / 2, 1, height);
  }
}

const LOOK_STRIP_STEP_PIXELS = 3;

// What BossBattles Stage does over time - three bands: the sky, the arena around you, something in the
// key colour - under a flag for each cue, with its fade as a ramp. Other packs' cues are flags only.
function drawLooks(ctx: CanvasRenderingContext2D, w: number, s: TimelineScene, t: Theme): void {
  const [top, height] = s.layout.rows.look, collapsed = s.layout.collapsed.has("look");
  // Collapsed, the strip is just the arena around you.
  const bands = collapsed ? 1 : 3, bandTop = top + (collapsed ? 1 : 4), bandHeight = (height - (collapsed ? 2 : 8)) / bands;
  const isStage = (cue: TimedLookCue) => cue.pack.toLowerCase() === STAGE_PACK.name.toLowerCase();
  const stageCues = s.lookCues.filter(isStage);
  ctx.fillStyle = alpha(t.wash, 0.02); ctx.fillRect(0, top, w, height);

  if (stageCues.length) {
    for (let px = 0; px < w; px += LOOK_STRIP_STEP_PIXELS) {
      const look = stageLookAt(stageCues, tOf(s.view, px + LOOK_STRIP_STEP_PIXELS / 2));
      if (!look.on) continue;
      const preview = stagePreview(look);
      (collapsed ? [preview.surroundings] : [preview.sky, preview.surroundings, preview.keyColoured]).forEach((colour, band) => {
        ctx.fillStyle = colour;
        ctx.fillRect(px, bandTop + band * bandHeight, LOOK_STRIP_STEP_PIXELS, bandHeight);
      });
    }
  }

  ctx.font = `10px ${t.mono}`; ctx.textAlign = "left";
  for (const cue of s.lookCues) {
    const cx = xOf(s.view, cue.time), selected = cue.index === s.selectedLookCue;
    if (cx < -40 || cx > w + 40) continue;
    if (cue.fade > 0) {
      ctx.strokeStyle = alpha(t.wash, 0.67); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, top + height - 3); ctx.lineTo(xOf(s.view, cue.time + cue.fade), top + 3); ctx.stroke();
    }
    ctx.fillStyle = selected ? t.text : isStage(cue) ? t.look : t.textDim;
    ctx.fillRect(cx - 1, top, 2, height);
    if (collapsed) continue;
    ctx.beginPath(); ctx.moveTo(cx - 1, top); ctx.lineTo(cx + 8, top + 4); ctx.lineTo(cx - 1, top + 8); ctx.fill();
    if (selected) { ctx.strokeStyle = t.look; ctx.lineWidth = 2; ctx.strokeRect(cx - 3, top + 1, 6, height - 2); }
    const label = cue.off ? "off" : isStage(cue) ? "" : cue.pack;
    if (label) { ctx.fillStyle = t.text; ctx.fillText(label, cx + 10, top + 9); }
  }
}
