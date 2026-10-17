import { peakBetween } from "../../audio/peaks";
import { endOf, evTime, phaseTime } from "../../model/chart";
import type { Tempo } from "../../model/tempo";
import type { LoadedChart } from "../../model/types";
import type { ClipSpan } from "../../io/files";
import type { Song } from "../../store/editor.svelte";
import { drawBox, type Box, type Theme } from "../theme";
import { ROWS, tOf, xOf, type Marker, type View } from "./geometry";

export type TimelineScene = {
  chart: LoadedChart;
  tempo: Tempo;
  view: View;
  time: number;
  snap: number;
  selection: ReadonlySet<number>;
  selectedPhase: number;
  markers: Marker[];
  song: Song | null;
  /** Where the chart starts in the song. */
  songStart: number;
  clips: Map<string, ClipSpan>;
  box: Box | null;
};

export function drawTimeline(ctx: CanvasRenderingContext2D, w: number, h: number, s: TimelineScene, t: Theme): void {
  const { chart: c, tempo: tp, view } = s, x = (time: number) => xOf(view, time), end = endOf(c, tp);
  ctx.fillStyle = "#171a1f"; ctx.fillRect(0, 0, w, h);
  const t0 = view.t0, t1 = tOf(view, w);
  ctx.font = `10px ${t.mono}`;

  // Beats and bars, else seconds.
  if (tp.ok) {
    const b0 = Math.floor(tp.beat(Math.max(0, t0))), b1 = Math.ceil(tp.beat(Math.max(0, t1)));
    const sub = s.snap && view.pps * 60 / tp.bpmAt(Math.max(0, t0)) * s.snap > 10 ? s.snap : 1;
    for (let b = b0; b <= b1; b += sub) {
      const bx = x(tp.seconds(b)), bar = b % 4 === 0, whole = Number.isInteger(b);
      ctx.fillStyle = bar ? "#3a414d" : whole ? "#2a3039" : "#22272e";
      ctx.fillRect(bx, ROWS.ruler[1], 1, h - ROWS.ruler[1]);
      if (bar) { ctx.fillStyle = t.dust; ctx.textAlign = "left"; ctx.fillText(`${b / 4 + 1}`, bx + 3, 14); }
    }
  } else {
    for (let sec = Math.max(0, Math.floor(t0)); sec <= t1; sec++) {
      const sx = x(sec);
      ctx.fillStyle = "#2a3039"; ctx.fillRect(sx, ROWS.ruler[1], 1, h);
      ctx.fillStyle = t.dust; ctx.textAlign = "left"; ctx.fillText(`${sec}s`, sx + 3, 14);
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

  // Row bands.
  ctx.fillStyle = "#ffffff08";
  for (const k of ["phase", "move"] as const) ctx.fillRect(0, ROWS[k][0], w, ROWS[k][1]);

  // Phases.
  const phases = c.phases ?? [];
  phases.forEach((p, i) => {
    const a = x(phaseTime(p, tp)), b = x(i + 1 < phases.length ? phaseTime(phases[i + 1], tp) : end);
    ctx.fillStyle = i === s.selectedPhase ? "#4fd1a555" : (i % 2 ? "#4fd1a522" : "#4fd1a533");
    ctx.fillRect(a, ROWS.phase[0] + 2, b - a - 1, ROWS.phase[1] - 4);
    ctx.fillStyle = t.phase; ctx.textAlign = "left";
    ctx.fillText(`${p.name || "Phase " + (i + 1)}${p.scoreMultiplier && p.scoreMultiplier !== 1 ? " ×" + p.scoreMultiplier : ""}`, a + 4, ROWS.phase[0] + 15);
  });

  // Events, where the markers put them.
  for (const { i, x: mx, y } of s.markers) {
    const e = c.events[i], sel = s.selection.has(i);
    if (e.projectile) {
      const spawn = evTime(e, tp) - (e.projectile.telegraph ?? 0.5);
      ctx.fillStyle = "#ffd16655"; ctx.fillRect(x(spawn), y - 2, mx - x(spawn), 4);
      ctx.fillStyle = sel ? t.sand : t.lane;
      ctx.beginPath(); ctx.moveTo(mx, y - 7); ctx.lineTo(mx + 6, y); ctx.lineTo(mx, y + 7); ctx.lineTo(mx - 6, y); ctx.fill();
      if (sel) { ctx.strokeStyle = t.lane; ctx.lineWidth = 2; ctx.stroke(); }
    } else {
      ctx.fillStyle = sel ? t.sand : (e.at ? t.phase : t.move);
      if (e.at) ctx.fillRect(mx - 5, y - 5, 10, 10);
      else { ctx.beginPath(); ctx.moveTo(mx - 6, y + 6); ctx.lineTo(mx, y - 7); ctx.lineTo(mx + 6, y + 6); ctx.fill(); }
      ctx.textAlign = "left"; ctx.fillStyle = t.dust;
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
      ctx.fillStyle = "#b38cff33"; ctx.fillRect(x(start), ROWS.clip[0] + 4, x(stop) - x(start) - 1, ROWS.clip[1] - 8);
      ctx.fillStyle = t.clip; ctx.textAlign = "left"; ctx.fillText(k.clip, x(start) + 4, ROWS.clip[0] + 19);
    });
  }

  // Row names.
  ctx.fillStyle = t.dust; ctx.textAlign = "right"; ctx.font = `600 10px ${t.body}`;
  for (const [name, row] of [["PHASES", "phase"], ["PROJECTILES", "shot"], ["MOVES · SPOTS", "move"], ["RECORDED", "clip"]] as const) {
    ctx.fillText(name, w - 6, ROWS[row][0] + 11);
  }

  // End and playhead.
  ctx.fillStyle = t.bad; ctx.fillRect(x(end), ROWS.ruler[1], 2, h);
  ctx.fillStyle = t.sand; ctx.fillRect(x(s.time), 0, 2, h);
}

/** The song's waveform, lined up with chart time (song time - music.start). */
function drawWave(ctx: CanvasRenderingContext2D, w: number, s: TimelineScene, t: Theme): void {
  const [y0, hh] = ROWS.wave, mid = y0 + hh / 2;
  ctx.fillStyle = "#ffffff06"; ctx.fillRect(0, y0, w, hh);
  const buffer = s.song?.buffer, peaks = s.song?.peaks;
  if (!buffer || !peaks) {
    ctx.fillStyle = t.dust; ctx.textAlign = "left"; ctx.font = `12px ${t.body}`;
    const file = s.chart.music?.file;
    ctx.fillText(file ? `Open ${file} to see and hear it` : "No song - add one in the Chart tab, then open the file", 8, mid + 4);
    ctx.font = `10px ${t.mono}`;
    return;
  }
  ctx.fillStyle = "#9fb3c8aa";
  for (let px = 0; px < w; px++) {
    const a = tOf(s.view, px) + s.songStart, b = tOf(s.view, px + 1) + s.songStart;
    if (b < 0 || a > buffer.duration) continue;
    const height = Math.max(1, peakBetween(peaks, a, b) * (hh - 4));
    ctx.fillRect(px, mid - height / 2, 1, height);
  }
}
