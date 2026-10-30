import { peakBetween } from "../../audio/peaks";
import { endOf, evTime, phaseTime } from "../../model/chart";
import { STAGE_PACK, stageLookAt, type TimedLookCue } from "../../model/looks";
import { stageStrip, type StageSparkle, type StageStrip } from "../../model/stageFrame";
import { BEATS_PER_BAR, gridLines, type Tempo } from "../../model/tempo";
import { playedClips, type TrackRow } from "../../model/tracks";
import type { LoadedChart } from "../../model/types";
import type { ClipSpan } from "../../io/files";
import type { Song } from "../../store/session.svelte";
import { shotPaint, stripePath, type ShotColouring } from "../shotColours";
import { alpha, drawBox, type Box, type Theme } from "../theme";
import { clipLaneSpan, tOf, xOf, type Marker, type TimelineLayout, type View } from "./geometry";

/** Everything the timeline shows but the playhead, which moves every frame while playing and is drawn over it. */
export type TimelineScene = {
  chart: LoadedChart;
  tempo: Tempo;
  view: View;
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
  /** The recorded-clips row's lanes, one per track, from trackRows. */
  trackRows: TrackRow[];
  box: Box | null;
  layout: TimelineLayout;
  /** The A-B loop, shaded, or null. */
  loop: readonly [number, number] | null;
  /** A loop's first point while the second isn't set yet, or null. */
  loopStart: number | null;
  shotColouring: ShotColouring;
};

/** The timeline but its playhead: drawn once and kept while only the playhead moves. */
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
    for (const { beat: b, whole, bar } of gridLines(b0, b1, sub)) {
      const bx = x(tp.seconds(b));
      ctx.fillStyle = bar ? t.gridBar : whole ? t.gridBeat : t.grid;
      ctx.fillRect(bx, rulerBottom, 1, h - rulerBottom);
      if (bar) { ctx.fillStyle = t.textDim; ctx.textAlign = "left"; ctx.fillText(`${b / BEATS_PER_BAR + 1}`, bx + 3, 14); }
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
  for (const { i, x: mx, y, left, right } of s.markers) {
    // Off screen, telegraph bar and name too: skipped without reading the chart.
    if (right < 0 || left > w) continue;
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

  // Recorded clips (made in game - shown, kept, not edited here): a lane per track, in the order of the
  // actors. Each clip runs until the next in its own track; mimed ones are faint and hatched.
  const clipCollapsed = collapsed.has("clip");
  s.trackRows.forEach((row, lane) => {
    const [laneTop, laneHeight] = clipLaneSpan(s.layout, lane), inset = clipCollapsed ? 1 : 3;
    if (lane > 0 && !clipCollapsed) { ctx.fillStyle = t.grid; ctx.fillRect(0, Math.round(laneTop), w, 1); }
    const played = playedClips(c.tracks?.[row.track]?.clips ?? [], tp, end, clip => s.clips.get(clip)?.end);
    for (const k of played) {
      const a = Math.max(-2, x(k.start)), b = Math.min(w + 2, x(k.stop) - 1);
      if (b <= a) continue;
      const box = { x: a, y: laneTop + inset, w: b - a, h: laneHeight - inset * 2 };
      ctx.fillStyle = alpha(t.clip, k.mime ? 0.07 : 0.22);
      ctx.fillRect(box.x, box.y, box.w, box.h);
      if (k.mime) hatchMime(ctx, box, t);
      if (clipCollapsed || laneHeight < 16) continue;
      ctx.fillStyle = k.mime ? t.textDim : t.clip; ctx.textAlign = "left";
      ctx.fillText(k.mime ? `${k.clip} (mime)` : k.clip, x(k.start) + 4, laneTop + laneHeight / 2 + 4);
    }
  });

  // The end.
  ctx.fillStyle = t.bad; ctx.fillRect(x(end), rulerBottom, 2, h);
}

export function drawPlayhead(ctx: CanvasRenderingContext2D, h: number, view: View, time: number, t: Theme): void {
  ctx.fillStyle = t.text; ctx.fillRect(xOf(view, time), 0, 2, h);
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

// The strip's samples, kept for each list of cues (a new list when the looks change) at one zoom: working
// out the look at a moment walks every cue, and a redraw takes hundreds.
const stripSamples = new WeakMap<TimedLookCue[], { step: number; strips: Map<number, StageStrip | null> }>();

function stripAt(lookCues: TimedLookCue[], stageCues: TimedLookCue[], step: number, k: number): StageStrip | null {
  let kept = stripSamples.get(lookCues);
  if (kept?.step !== step) { kept = { step, strips: new Map() }; stripSamples.set(lookCues, kept); }
  let strip = kept.strips.get(k);
  if (strip === undefined) {
    const look = stageLookAt(stageCues, (k + 0.5) * step);
    strip = look.on ? stageStrip(look) : null;
    kept.strips.set(k, strip);
  }
  return strip;
}
// The sky and the arena take most of the strip; the things in the key colour are a thin band, as they are a
// small part of the screen.
const LOOK_BAND_SHARES = [0.36, 0.44, 0.2];

// What BossBattles Stage does over time - three bands: the sky, the arena around you, the things in the
// key colour - with its glitter and motes sparkling over the top one, under a flag for each cue, with its
// fade as a ramp. Other packs' cues are flags only.
function drawLooks(ctx: CanvasRenderingContext2D, w: number, s: TimelineScene, t: Theme): void {
  const [top, height] = s.layout.rows.look, collapsed = s.layout.collapsed.has("look");
  // Collapsed, the strip is just the arena around you.
  const shares = collapsed ? [1] : LOOK_BAND_SHARES, stripTop = top + (collapsed ? 1 : 4), stripHeight = height - (collapsed ? 2 : 8);
  const isStage = (cue: TimedLookCue) => cue.pack.toLowerCase() === STAGE_PACK.name.toLowerCase();
  const stageCues = s.lookCues.filter(isStage);
  ctx.fillStyle = alpha(t.wash, 0.02); ctx.fillRect(0, top, w, height);

  if (stageCues.length) {
    // Sampled at steady moments of chart time, not at pixels, so scrolling doesn't change what is sampled.
    const step = LOOK_STRIP_STEP_PIXELS / s.view.pps;
    for (let k = Math.floor(tOf(s.view, 0) / step); k * step < tOf(s.view, w); k++) {
      const strip = stripAt(s.lookCues, stageCues, step, k);
      if (!strip) continue;
      const x = Math.floor(xOf(s.view, k * step)), stepWidth = Math.ceil(xOf(s.view, (k + 1) * step)) - x;
      let y = stripTop;
      (collapsed ? [strip.surroundings] : [strip.sky, strip.surroundings, strip.keyColoured]).forEach((colour, band) => {
        const bandHeight = stripHeight * shares[band];
        ctx.fillStyle = colour;
        ctx.fillRect(x, y, stepWidth, bandHeight);
        if (band === 0 && strip.sparkle) drawSparkles(ctx, k, x, y, stepWidth, bandHeight, strip.sparkle);
        y += bandHeight;
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

// A mimed clip: hatched and edged with dashes in the clip colour, so it reads as there but not sung.
function hatchMime(ctx: CanvasRenderingContext2D, box: { x: number; y: number; w: number; h: number }, t: Theme): void {
  ctx.save();
  ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
  ctx.strokeStyle = alpha(t.clip, 0.35); ctx.lineWidth = 1;
  ctx.beginPath();
  for (let d = -box.h; d < box.w; d += 6) { ctx.moveTo(box.x + d, box.y + box.h); ctx.lineTo(box.x + d + box.h, box.y); }
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = alpha(t.clip, 0.7); ctx.setLineDash([3, 3]);
  ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1);
  ctx.setLineDash([]);
}

// A steady random number from 0 to 1 for a strip step and a slot in it, so sparkles stay put as the timeline scrolls.
const sparkleRandom = (k: number, slot: number, salt: number) => {
  const v = Math.sin(k * 12.9898 + slot * 78.233 + salt * 37.719) * 43758.5453;
  return v - Math.floor(v);
};

// Glitter as fine points and motes as soft larger ones, about as thick as the look makes them, in the
// sparkle colour - or the rainbow, as Rainbow shimmer turns up.
function drawSparkles(ctx: CanvasRenderingContext2D, k: number, x: number, y: number, w: number, h: number, sparkle: StageSparkle): void {
  const dot = (slot: number, chance: number, size: number, opacity: number) => {
    if (sparkleRandom(k, slot, 1) >= chance) return;
    const rainbow = sparkleRandom(k, slot, 4) < sparkle.shimmer;
    ctx.globalAlpha = opacity;
    ctx.fillStyle = rainbow ? `hsl(${Math.round(sparkleRandom(k, slot, 5) * 360)} 90% 70%)` : sparkle.colour;
    ctx.fillRect(x + sparkleRandom(k, slot, 2) * Math.max(0, w - size), y + sparkleRandom(k, slot, 3) * Math.max(0, h - size), size, size);
  };
  // Glitter runs to 2 and its density to 1; Motes to 2.
  for (let slot = 0; slot < 2; slot++) dot(slot, sparkle.glitter * 0.3, 1, 1);
  dot(2, sparkle.motes * 0.12, 2, 0.75);
  ctx.globalAlpha = 1;
}
