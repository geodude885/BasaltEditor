// Close calls: two structures that may touch before they're on their way - hitstunning, slowing or breaking each
// other in the game. Each projectile is a box of its structure's measured size, waiting at `from` from `telegraph`
// seconds before its time, then flying in a straight line to where it aims; a close call is two boxes coming within
// a margin while at least one of them is still waiting. Straight lines ignore the flight's slight arc and anything
// a first knock sets off, so it says what might touch, not what will. Not a problem: the game plays it either way,
// and it may be meant.
import { aimPointOf, evTime, flightTime, onFloor } from "./chart";
import { SIZES } from "./constants";
import type { Tempo } from "./tempo";
import type { LoadedChart, Projectile } from "./types";

/** Two projectiles (indices into chart.events) that may touch, when they first would, and how. */
export type CloseCall = {
  a: number;
  b: number;
  /** When they would first touch, in seconds. */
  at: number;
  /** Both still waiting to launch, or one launched and not yet out of the other's way. */
  kind: "waiting" | "in-the-way";
};

/** Room kept round each structure: the game's physics touches a little before the shapes meet. */
export const CLOSE_CALL_MARGIN_METRES = 0.05;
/** How finely the moments they share are stepped through. */
const STEP_SECONDS = 1 / 50;

type Box = { x: number; y: number; z: number };
type Flight = {
  index: number; spawn: number; launch: number; arrive: number;
  half: Box; from: Box; to: Box;
};

/** Where a projectile's box is centred: waiting at `from`, then on the straight line to its aim at your end. */
function centreAt(f: Flight, time: number): Box {
  if (time <= f.launch || f.arrive <= f.launch) return f.from;
  const k = Math.min(1, (time - f.launch) / (f.arrive - f.launch));
  return { x: f.from.x + (f.to.x - f.from.x) * k, y: f.from.y + (f.to.y - f.from.y) * k, z: f.from.z + (f.to.z - f.from.z) * k };
}

function flightOf(p: Projectile, index: number, time: number): Flight | null {
  const size = SIZES[p.structure];
  if (!size || !Number.isFinite(time)) return null;
  const tel = Math.max(0, +(p.telegraph ?? 0.5) || 0), aim = aimPointOf(p), from = p.from ?? { x: 0, y: 0, z: 0 };
  const pivot = (size as { pivotUp?: number }).pivotUp ?? size.up / 2;
  // A structure on the floor rests on it and slides along it; one in the air hangs from its pivot.
  const floor = onFloor(p), up = size.up / 2;
  const heightAt = (y: number) => (floor ? up : y - pivot + up);
  return {
    index, spawn: time - tel, launch: time, arrive: time + flightTime(p, aim),
    half: { x: size.across / 2 + CLOSE_CALL_MARGIN_METRES, y: up + CLOSE_CALL_MARGIN_METRES, z: size.along / 2 + CLOSE_CALL_MARGIN_METRES },
    from: { x: +from.x || 0, y: heightAt(+from.y || 0), z: +from.z || 0 },
    to: { x: aim.x, y: heightAt(aim.y), z: 0 },
  };
}

const touching = (a: Box, b: Box, ha: Box, hb: Box) =>
  Math.abs(a.x - b.x) < ha.x + hb.x && Math.abs(a.y - b.y) < ha.y + hb.y && Math.abs(a.z - b.z) < ha.z + hb.z;

/** Every close call in a chart, by when it happens. */
export function closeCalls(c: LoadedChart, tp: Tempo): CloseCall[] {
  const flights = c.events.flatMap((e, i) => (e.projectile ? [flightOf(e.projectile, i, evTime(e, tp))] : []))
    .filter((f): f is Flight => !!f).sort((a, b) => a.spawn - b.spawn);
  const found: CloseCall[] = [];
  for (let i = 0; i < flights.length; i++) {
    const a = flights[i];
    for (let j = i + 1; j < flights.length && flights[j].spawn < a.arrive; j++) {
      const b = flights[j];
      // Only while one of them still waits: two on their way crossing is a pattern, not a spawn gone wrong.
      const from = Math.max(a.spawn, b.spawn), to = Math.min(a.arrive, b.arrive, Math.max(a.launch, b.launch));
      for (let t = from; t <= to; t += STEP_SECONDS) {
        if (!touching(centreAt(a, t), centreAt(b, t), a.half, b.half)) continue;
        const [first, second] = a.index < b.index ? [a.index, b.index] : [b.index, a.index];
        found.push({ a: first, b: second, at: t, kind: t < a.launch && t < b.launch ? "waiting" : "in-the-way" });
        break;
      }
    }
  }
  return found.sort((x, y) => x.at - y.at);
}

/** What a close call is, in words: "Disc and RockCube may touch while both wait", or "… before the Disc is out of the way". */
export function closeCallText(c: LoadedChart, call: CloseCall): string {
  const a = c.events[call.a]?.projectile?.structure ?? "?", b = c.events[call.b]?.projectile?.structure ?? "?";
  const pair = a === b ? `Two ${a}s` : `${a} and ${b}`;
  return call.kind === "waiting" ? `${pair} may touch while both wait to launch` : `${pair} may touch: one launched, not yet out of the other's way`;
}

/**
 * What a close call is about, to remember it as meant: both projectiles as they are, so moving or changing
 * either brings the warning back.
 */
export function closeCallKey(c: LoadedChart, call: CloseCall): string {
  const text = `${JSON.stringify(c.events[call.a])}|${JSON.stringify(c.events[call.b])}`;
  // FNV-1a, twice over with different starts: short enough to keep many, long enough not to collide.
  let h1 = 0x811c9dc5, h2 = 0x01000193 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h1 = Math.imul(h1 ^ text.charCodeAt(i), 0x01000193);
    h2 = Math.imul(h2 ^ text.charCodeAt(i), 0x5bd1e995);
  }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}
