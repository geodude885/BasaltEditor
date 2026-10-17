// Reading a chart: the defaults the mod applies, times, and where things are.
import { GROUNDED, GROUNDED_STATE } from "./constants";
import { round, type Tempo } from "./tempo";
import type { Actor, Chart, ChartEvent, EventKind, LaneColours, LoadedChart, Phase, Projectile } from "./types";

export type Lane = { length: number; width: number };
export type Zone = { length: number; height: number };
export type Point = { x: number; z: number };

export const laneOf = (c: Chart): Lane => ({ length: +(c.lane?.length ?? 12), width: +(c.lane?.width ?? 3) });

/** The chart's actors, or the one the mod makes when it names none. */
export function actorsOf(c: Chart): Actor[] {
  return Array.isArray(c.actors) && c.actors.length ? c.actors : [{ id: "actor", name: "Actor", at: { x: 0, z: laneOf(c).length } }];
}
export const firstActorId = (c: Chart): string => actorsOf(c)[0].id ?? "actor";

/** Your zone: how far down the lane you may go and how high - 2 m short of the far end and 3.5 m without one. */
export function zoneOf(c: Chart): Zone {
  const L = laneOf(c), z = c.zone ?? {};
  return { length: +(z.length ?? (L.length > 4 ? L.length - 2 : L.length / 2)), height: +(z.height ?? 3.5) };
}

export const coloursOf = (c: Chart): LaneColours => c.colours ?? c.colors ?? {};

export function evTime(ev: ChartEvent, tp: Tempo): number {
  if (ev.t != null) return +ev.t;
  return ev.beat != null && tp.ok ? tp.seconds(+ev.beat) : NaN;
}

/** Moves an event to a time, keeping it in beats if it was written in beats. */
export function setEvTime(ev: ChartEvent, seconds: number, tp: Tempo): void {
  seconds = Math.max(0, seconds);
  if (ev.beat != null && tp.ok) ev.beat = round(tp.beat(seconds), 4);
  else ev.t = round(seconds, 3);
}

export function phaseTime(p: Phase, tp: Tempo): number {
  if (p.start != null) return +p.start;
  return p.startBeat != null && tp.ok ? tp.seconds(+p.startBeat) : 0;
}

/** When the battle ends: the chart's end, else 3 s after its last event. */
export function endOf(c: LoadedChart, tp: Tempo): number {
  return c.end ?? (Math.max(0, ...c.events.map(e => evTime(e, tp)).filter(Number.isFinite)) + 3);
}

export const kindOf = (ev: ChartEvent): EventKind =>
  ev.projectile ? "projectile" : ev.move != null ? "move" : ev.at ? "at" : "?";

/** Thrown grounded: in the game's grounded state (more damage), along the floor. */
export const isGrounded = (s: Projectile): boolean => s.grounded ?? GROUNDED_STATE.includes(s.structure);
/** Sits on the floor: grounded, or a structure that always rises out of it. */
export const onFloor = (s: Projectile): boolean => isGrounded(s) || GROUNDED.includes(s.structure);

/**
 * Where an actor stands at a time: its spot, then the latest phase or "at" event that moved it. The
 * mod runs a phase's spot as a placement at the phase's start, on the same timeline as events
 * (ChartRunner), so whichever came last wins.
 */
export function actorSpotAt(c: LoadedChart, actor: Actor, t: number, tp: Tempo): Point {
  let at: Point = actor.at ?? { x: 0, z: laneOf(c).length }, when = -Infinity;
  const first = firstActorId(c);
  const consider = (spot: Point | undefined, who: string | undefined, time: number) => {
    if (spot && (who ?? first) === actor.id && time <= t && time >= when) { at = spot; when = time; }
  };
  for (const p of c.phases ?? []) consider(p.at, p.actor, phaseTime(p, tp));
  for (const e of c.events) consider(e.at, e.actor, evTime(e, tp));
  return { x: +at.x || 0, z: +at.z || 0 };
}

/** How long a projectile flies, from where it starts to where it aims. */
export function flightTime(s: Projectile, aim: { x?: number; y?: number }): number {
  const f = s.from ?? { x: 0, y: 0, z: 0 };
  return Math.hypot((aim.x || 0) - (f.x || 0), (aim.y ?? 1.3) - (f.y || 0), f.z || 0) / Math.max(0.1, s.speed || 1);
}

/** Opacity of a "#RRGGBBAA" colour, 0 to 1 (1 without alpha). */
export const alphaOf = (hex: string | undefined): number => hex && hex.length === 9 ? parseInt(hex.slice(7), 16) / 255 : 1;
/** A colour input's value with an opacity, as "#RRGGBBAA". */
export const withAlpha = (hex: string, a: number): string =>
  hex.slice(0, 7) + Math.round(Math.min(1, Math.max(0, a)) * 255).toString(16).padStart(2, "0");

export const stoneName = (s: string | undefined): string => (s ?? "").replace(/\s*stone$/i, "");
