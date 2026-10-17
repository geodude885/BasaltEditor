import { actorSpotAt, actorsOf, evTime, flightTime, isGrounded, laneOf, zoneOf } from "../../model/chart";
import { GROUNDED, PLAYER_HEAD } from "../../model/constants";
import { round, type Tempo } from "../../model/tempo";
import type { LoadedChart } from "../../model/types";
import { drawBox, type Box, type Theme } from "../theme";
import { footprint, isRound, originPx, type LaneMap } from "./geometry";

export type LaneScene = {
  chart: LoadedChart;
  tempo: Tempo;
  time: number;
  selection: ReadonlySet<number>;
  /** The box being dragged to select, or null. */
  box: Box | null;
};

export function drawLane(ctx: CanvasRenderingContext2D, w: number, h: number, map: LaneMap, scene: LaneScene, t: Theme): void {
  const { chart: c, tempo: tp, time } = scene, L = laneOf(c), P = map.toPx;
  ctx.clearRect(0, 0, w, h);

  // Floor, lane, ends, backstop.
  ctx.fillStyle = "#1a1e23"; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#2a2622";
  const [lx0, lz0] = P(-L.width / 2, L.length), [lx1, lz1] = P(L.width / 2, 0);
  ctx.fillRect(lx0, lz0, lx1 - lx0, lz1 - lz0);
  ctx.strokeStyle = t.lane; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(lx0, lz0); ctx.lineTo(lx0, lz1); ctx.moveTo(lx1, lz0); ctx.lineTo(lx1, lz1); ctx.stroke();
  ctx.strokeStyle = "#ffd36a";
  ctx.beginPath(); ctx.moveTo(lx0, lz1); ctx.lineTo(lx1, lz1); ctx.moveTo(lx0, lz0); ctx.lineTo(lx1, lz0); ctx.stroke();
  ctx.strokeStyle = "#ff7a1a66"; ctx.setLineDash([4, 4]);
  const [bx0, bz] = P(-L.width / 2 - 1, -0.9), [bx1] = P(L.width / 2 + 1, -0.9);
  ctx.beginPath(); ctx.moveTo(bx0, bz); ctx.lineTo(bx1, bz); ctx.stroke(); ctx.setLineDash([]);

  // Your zone: where you may go, and the line you stop at.
  const Z = zoneOf(c);
  if (Z.length < L.length) {
    const [zx0, zy] = P(-L.width / 2, Z.length), [zx1] = P(L.width / 2, Z.length);
    ctx.fillStyle = "#ffffff0d"; ctx.fillRect(zx0, zy, zx1 - zx0, lz1 - zy);
    ctx.strokeStyle = "#f2f2d9"; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(zx0, zy); ctx.lineTo(zx1, zy); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "#f2f2d9"; ctx.font = `10px ${t.mono}`; ctx.textAlign = "left";
    ctx.fillText(`your zone · ${Z.height} m high`, zx1 + 4, zy + 3);
  }

  // Metre ticks along the left edge.
  ctx.fillStyle = t.dust; ctx.font = `10px ${t.mono}`; ctx.textAlign = "right";
  for (let z = 0; z <= L.length; z += 2) { const [x, y] = P(-L.width / 2, z); ctx.fillText(`${z}m`, x - 5, y + 3); }

  // You, and the actors where they stand at the playhead.
  const [yx, yy] = P(0, 0);
  ctx.fillStyle = t.sand; ctx.beginPath(); ctx.arc(yx, yy, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = t.dust; ctx.textAlign = "center"; ctx.fillText("you", yx, yy + 20);
  for (const a of actorsOf(c)) {
    const at = actorSpotAt(c, a, time, tp), [ax, ay] = P(at.x, at.z);
    ctx.fillStyle = t.move; ctx.beginPath(); ctx.arc(ax, ay, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = t.sand; ctx.font = `600 11px ${t.body}`; ctx.fillText(a.name || a.id || "", ax, ay - 13);
  }

  // Projectiles: faint where they start; spawned ones at the playhead (yellow until thrown); the selection with its aim.
  c.events.forEach((e, i) => {
    const s = e.projectile;
    if (!s?.from) return;
    const launch = evTime(e, tp), spawn = launch - (s.telegraph ?? 0.5);
    const selected = scene.selection.has(i);
    const [fx, fy] = originPx(s, map);
    const aim = s.to === "player" || s.to == null ? { x: 0, y: PLAYER_HEAD } : s.to;
    const [tx, ty] = P(+aim.x || 0, 0);
    const flight = flightTime(s, aim);

    if (selected) {
      ctx.strokeStyle = t.lane; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = t.lane; ctx.beginPath(); ctx.arc(tx, ty, 5, 0, Math.PI * 2); ctx.fill();
      ctx.font = `10px ${t.mono}`; ctx.fillStyle = t.sand; ctx.textAlign = "left";
      ctx.fillText(isGrounded(s) ? "grounded" : GROUNDED.includes(s.structure) ? "on the floor" : `y ${round(+s.from.y || 0, 2)}`, fx + 10, fy + 4);
    }
    // Not in play: faded by how far it is from the playhead - what is coming soon stands out, what has
    // gone fades fast, and anything far off is not drawn (the selection always is).
    const ahead = spawn - time, behind = time - (launch + flight);
    const fade = ahead > 0 ? 0.6 * Math.exp(-ahead / 3) : 0.35 * Math.exp(-behind / 1.2);
    if (!selected && !(time >= spawn && time < launch + flight) && fade < 0.03) return;
    let x = fx, y = fy, live = false, alpha = selected ? 1 : Math.max(0.03, fade);
    if (time >= spawn && time < launch) { live = true; alpha = 1; }
    else if (time >= launch && time < launch + flight) {
      live = true; alpha = 1;
      const k = (time - launch) / flight;
      x = fx + (tx - fx) * k; y = fy + (ty - fy) * k;
    }
    ctx.globalAlpha = alpha;
    ctx.fillStyle = time < launch && live ? t.telegraph : (live ? t.lane : t.sand);
    shape(ctx, s.structure, map.scale, x, y);
    ctx.globalAlpha = 1;
    if (selected) { ctx.strokeStyle = t.sand; ctx.lineWidth = 1.5; shape(ctx, s.structure, map.scale, x, y, 5, true); }
  });

  if (scene.box) drawBox(ctx, scene.box, t);
}

/** A structure's footprint, filled - or stroked, with `outline`. */
function shape(ctx: CanvasRenderingContext2D, structure: string, scale: number, x: number, y: number, grow = 0, outline = false): void {
  const { hw, hh } = footprint(structure, scale, grow);
  ctx.beginPath();
  if (isRound(structure)) ctx.ellipse(x, y, hw, hh, 0, 0, Math.PI * 2);
  else ctx.rect(x - hw, y - hh, hw * 2, hh * 2);
  if (outline) ctx.stroke(); else ctx.fill();
}
