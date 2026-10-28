import { actorSpotAt, actorsOf, evTime, flightTime, isGrounded, laneOf, zoneOf } from "../../model/chart";
import { GROUNDED, PLAYER_HEAD } from "../../model/constants";
import { round, type Tempo } from "../../model/tempo";
import type { LoadedChart, Projectile } from "../../model/types";
import { shotPaint, stripePath, type ShotColouring } from "../shotColours";
import { alpha, drawBox, type Box, type Theme } from "../theme";
import { footprint, isRound, originPx, type LaneMap } from "./geometry";

export type LaneScene = {
  chart: LoadedChart;
  tempo: Tempo;
  time: number;
  selection: ReadonlySet<number>;
  /** The box being dragged to select, or null. */
  box: Box | null;
  shotColouring: ShotColouring;
  /** The projectiles' moments, from laneShots. */
  shots: LaneShots;
};

export function drawLane(ctx: CanvasRenderingContext2D, w: number, h: number, map: LaneMap, scene: LaneScene, t: Theme): void {
  const { chart: c, tempo: tp, time } = scene, L = laneOf(c), P = map.toPx;
  ctx.clearRect(0, 0, w, h);

  // Floor, lane, ends, backstop.
  ctx.fillStyle = t.floor; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = t.laneFloor;
  const [lx0, lz0] = P(-L.width / 2, L.length), [lx1, lz1] = P(L.width / 2, 0);
  ctx.fillRect(lx0, lz0, lx1 - lx0, lz1 - lz0);
  ctx.strokeStyle = t.accent; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(lx0, lz0); ctx.lineTo(lx0, lz1); ctx.moveTo(lx1, lz0); ctx.lineTo(lx1, lz1); ctx.stroke();
  ctx.strokeStyle = t.laneEnds;
  ctx.beginPath(); ctx.moveTo(lx0, lz1); ctx.lineTo(lx1, lz1); ctx.moveTo(lx0, lz0); ctx.lineTo(lx1, lz0); ctx.stroke();
  ctx.strokeStyle = alpha(t.accent, 0.4); ctx.setLineDash([4, 4]);
  const [bx0, bz] = P(-L.width / 2 - 1, -0.9), [bx1] = P(L.width / 2 + 1, -0.9);
  ctx.beginPath(); ctx.moveTo(bx0, bz); ctx.lineTo(bx1, bz); ctx.stroke(); ctx.setLineDash([]);

  // Your zone: where you may go, and the line you stop at.
  const Z = zoneOf(c);
  if (Z.length < L.length) {
    const [zx0, zy] = P(-L.width / 2, Z.length), [zx1] = P(L.width / 2, Z.length);
    ctx.fillStyle = alpha(t.wash, 0.05); ctx.fillRect(zx0, zy, zx1 - zx0, lz1 - zy);
    ctx.strokeStyle = t.zone; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(zx0, zy); ctx.lineTo(zx1, zy); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = t.zone; ctx.font = `10px ${t.mono}`; ctx.textAlign = "left";
    ctx.fillText(`your zone · ${Z.height} m high`, zx1 + 4, zy + 3);
  }

  // Metre ticks along the left edge.
  ctx.fillStyle = t.textDim; ctx.font = `10px ${t.mono}`; ctx.textAlign = "right";
  for (let z = 0; z <= L.length; z += 2) { const [x, y] = P(-L.width / 2, z); ctx.fillText(`${z}m`, x - 5, y + 3); }

  // You, and the actors where they stand at the playhead.
  const [yx, yy] = P(0, 0);
  ctx.fillStyle = t.text; ctx.beginPath(); ctx.arc(yx, yy, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = t.textDim; ctx.textAlign = "center"; ctx.fillText("you", yx, yy + 20);
  for (const a of actorsOf(c)) {
    const at = actorSpotAt(c, a, time, tp), [ax, ay] = P(at.x, at.z);
    ctx.fillStyle = t.move; ctx.beginPath(); ctx.arc(ax, ay, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = t.text; ctx.font = `600 11px ${t.body}`; ctx.fillText(a.name || a.id || "", ax, ay - 13);
  }

  // Projectiles: faint where they start; spawned ones at the playhead (yellow until thrown); the selection with
  // its aim. Only those near the playhead can show, so only those are looked at; the selection always is, on top.
  const { shots, longest } = scene.shots, from = time - SHOWN_AFTER_LANDING_SECONDS - longest;
  let lo = 0, hi = shots.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (shots[mid].spawn < from) lo = mid + 1; else hi = mid; }
  for (let j = lo; j < shots.length && shots[j].spawn <= time + SHOWN_BEFORE_SPAWNING_SECONDS; j++) {
    if (!scene.selection.has(shots[j].i)) drawShot(ctx, c, shots[j].i, false, map, scene, t);
  }
  for (const i of scene.selection) drawShot(ctx, c, i, true, map, scene, t);

  if (scene.box) drawBox(ctx, scene.box, t);
}

// How faint a projectile not in play is: what is coming soon stands out, what has gone fades fast. Below
// FADED_OUT it isn't drawn, which bounds how far either side of the playhead a projectile can show.
const FADED_OUT = 0.03, AHEAD_OPACITY = 0.6, AHEAD_FADE_SECONDS = 3, BEHIND_OPACITY = 0.35, BEHIND_FADE_SECONDS = 1.2;
const shotFade = (ahead: number, behind: number) =>
  ahead > 0 ? AHEAD_OPACITY * Math.exp(-ahead / AHEAD_FADE_SECONDS) : BEHIND_OPACITY * Math.exp(-behind / BEHIND_FADE_SECONDS);
const SHOWN_BEFORE_SPAWNING_SECONDS = AHEAD_FADE_SECONDS * Math.log(AHEAD_OPACITY / FADED_OUT);
const SHOWN_AFTER_LANDING_SECONDS = BEHIND_FADE_SECONDS * Math.log(BEHIND_OPACITY / FADED_OUT);

/** A projectile's moments on the lane: when it appears, and when it has landed. */
export type LaneShot = { i: number; spawn: number; end: number };
/** The chart's projectiles in the order they appear, and the longest any is on the lane - worked out once per chart. */
export type LaneShots = { shots: LaneShot[]; longest: number };

const aimOf = (s: Projectile) => s.to === "player" || s.to == null ? { x: 0, y: PLAYER_HEAD } : s.to;

export function laneShots(c: LoadedChart, tp: Tempo): LaneShots {
  const shots: LaneShot[] = [];
  let longest = 0;
  c.events.forEach((e, i) => {
    const s = e.projectile;
    if (!s?.from) return;
    const launch = evTime(e, tp), spawn = launch - (s.telegraph ?? 0.5), end = launch + flightTime(s, aimOf(s));
    if (!Number.isFinite(spawn) || !Number.isFinite(end)) return;
    shots.push({ i, spawn, end });
    longest = Math.max(longest, end - spawn);
  });
  shots.sort((a, b) => a.spawn - b.spawn);
  return { shots, longest };
}

function drawShot(ctx: CanvasRenderingContext2D, c: LoadedChart, i: number, selected: boolean, map: LaneMap, scene: LaneScene, t: Theme): void {
  const e = c.events[i], s = e?.projectile, time = scene.time, P = map.toPx;
  if (!s?.from) return;
  const launch = evTime(e, scene.tempo), spawn = launch - (s.telegraph ?? 0.5);
  const [fx, fy] = originPx(s, map);
  const aim = aimOf(s);
  const [tx, ty] = P(+aim.x || 0, 0);
  const flight = flightTime(s, aim);

  if (selected) {
    ctx.strokeStyle = t.accent; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = t.accent; ctx.beginPath(); ctx.arc(tx, ty, 5, 0, Math.PI * 2); ctx.fill();
    ctx.font = `10px ${t.mono}`; ctx.fillStyle = t.text; ctx.textAlign = "left";
    ctx.fillText(isGrounded(s) ? "grounded" : GROUNDED.includes(s.structure) ? "on the floor" : `y ${round(+s.from.y || 0, 2)}`, fx + 10, fy + 4);
  }
  // Not in play: faded by how far it is from the playhead - what is coming soon stands out, what has
  // gone fades fast, and anything far off is not drawn (the selection always is).
  const fade = shotFade(spawn - time, time - (launch + flight));
  if (!selected && !(time >= spawn && time < launch + flight) && fade < FADED_OUT) return;
  let x = fx, y = fy, live = false, alpha = selected ? 1 : Math.max(FADED_OUT, fade);
  if (time >= spawn && time < launch) { live = true; alpha = 1; }
  else if (time >= launch && time < launch + flight) {
    live = true; alpha = 1;
    const k = (time - launch) / flight;
    x = fx + (tx - fx) * k; y = fy + (ty - fy) * k;
  }
  ctx.globalAlpha = alpha;
  // Coloured by what it is, a waiting one keeps its colour inside a telegraph ring.
  const paint = shotPaint(s, scene.shotColouring, t), waiting = time < launch && live;
  ctx.fillStyle = paint.colour ?? (waiting ? t.telegraph : (live ? t.accent : t.text));
  shape(ctx, s.structure, map.scale, x, y);
  if (paint.striped) { const { hw, hh } = footprint(s.structure, map.scale, 0); stripePath(ctx, t, { x: x - hw, y: y - hh, w: hw * 2, h: hh * 2 }); }
  if (paint.colour && waiting) { ctx.strokeStyle = t.telegraph; ctx.lineWidth = 2; shape(ctx, s.structure, map.scale, x, y, 3, true); }
  ctx.globalAlpha = 1;
  if (selected) { ctx.strokeStyle = t.text; ctx.lineWidth = 1.5; shape(ctx, s.structure, map.scale, x, y, 5, true); }
}

/** A structure's footprint, filled - or stroked, with `outline`. */
function shape(ctx: CanvasRenderingContext2D, structure: string, scale: number, x: number, y: number, grow = 0, outline = false): void {
  const { hw, hh } = footprint(structure, scale, grow);
  ctx.beginPath();
  if (isRound(structure)) ctx.ellipse(x, y, hw, hh, 0, 0, Math.PI * 2);
  else ctx.rect(x - hw, y - hh, hw * 2, hh * 2);
  if (outline) ctx.stroke(); else ctx.fill();
}
