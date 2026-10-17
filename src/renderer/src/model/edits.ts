// Changes to a chart that are more than setting one field. Each mutates the chart it is given and
// returns the top-level keys it touched, for the document to write back into the text.
import { actorsOf, laneOf, phaseTime } from "./chart";
import { round, type Tempo } from "./tempo";
import type { ChartEvent, LoadedChart, TempoChange } from "./types";

/**
 * A longer or shorter lane takes the chart with it, as the game's lane setup does: every distance
 * along the lane - projectile origins, actor spots and moves, phase spots, your zone - is scaled, so
 * nothing is left past the far end (a chart saved without this would not load).
 */
export function resizeLane(c: LoadedChart, length: number): string[] {
  const old = laneOf(c).length;
  if (!(length > 2) || Math.abs(length - old) < 0.001) return [];
  const k = length / old, scale = (z: number) => round(Math.min(length, Math.max(0, (+z || 0) * k)), 2);
  const keys = ["lane", "events", "phases", "actors", "zone"].filter(key => key === "lane" || c[key as keyof LoadedChart] != null);
  c.lane = { length, width: laneOf(c).width };
  for (const e of c.events) {
    if (e.projectile?.from) e.projectile.from.z = scale(e.projectile.from.z);
    if (e.at) e.at.z = scale(e.at.z);
  }
  for (const p of c.phases ?? []) if (p.at) p.at.z = scale(p.at.z);
  if (Array.isArray(c.actors)) for (const a of c.actors) {
    a.at ??= { x: 0, z: old };
    a.at.z = Math.abs((+a.at.z || 0) - old) < 0.01 ? length : scale(a.at.z);
  }
  if (c.zone?.length != null) c.zone.length = Math.max(0.5, scale(c.zone.length));
  return keys;
}

/** Flips events left to right: projectile origins and aims, and actor spots. */
export function mirror(events: ChartEvent[]): void {
  for (const e of events) {
    if (e.projectile) {
      e.projectile.from.x = -(+e.projectile.from.x || 0);
      if (e.projectile.to && e.projectile.to !== "player") e.projectile.to.x = -(+e.projectile.to.x || 0);
    }
    if (e.at) e.at.x = -(+e.at.x || 0);
  }
}

/** A new event's time, snapped: in beats if the chart writes all its events in beats, else seconds. */
export function newTimed(c: LoadedChart, t: number, tp: Tempo, snap: number): ChartEvent {
  const useBeats = tp.ok && c.events.some(e => e.beat != null) && !c.events.some(e => e.t != null);
  const snapped = Math.max(0, tp.snap(t, snap));
  return useBeats ? { beat: round(tp.beat(snapped), 4) } : { t: round(snapped, 3) };
}

/** Starts a phase at a time (the chart's first phase too, if it had none). Returns its index. */
export function addPhaseAt(c: LoadedChart, t: number, tp: Tempo): number {
  c.phases ??= [{ name: "Start", start: 0 }];
  const phases = c.phases;
  if (!phases.some(p => Math.abs(phaseTime(p, tp) - t) < 0.01)) phases.push({ name: `Phase ${phases.length + 1}`, start: t });
  phases.sort((a, b) => phaseTime(a, tp) - phaseTime(b, tp));
  return phases.findIndex(p => Math.abs(phaseTime(p, tp) - t) < 0.01);
}

/** The chart's tempo as a list of changes - one entry for a single bpm. */
export function tempoList(c: LoadedChart): TempoChange[] {
  return Array.isArray(c.bpm) ? c.bpm.map(x => ({ ...x })) : (c.bpm ? [{ beat: 0, bpm: +c.bpm }] : []);
}

/** Writes a list of tempo changes back: a single bpm when there is only one. */
export function setTempo(c: LoadedChart, list: TempoChange[]): void {
  c.bpm = list.length === 1 ? list[0].bpm : [...list].sort((a, b) => a.beat - b.beat);
}

/** A tempo change at the whole beat nearest a time, at the tempo already playing there. */
export function addTempoChange(c: LoadedChart, t: number, tp: Tempo): void {
  if (!tp.ok) { c.bpm = 120; return; }
  const list = tempoList(c), beat = Math.max(1, Math.round(tp.beat(t)));
  if (!list.some(x => x.beat === beat)) list.push({ beat, bpm: tp.bpmAt(t) });
  setTempo(c, list);
}

/** A new actor beside the others, at the far end. */
export function addActor(c: LoadedChart): void {
  const all = actorsOf(c), n = all.length + 1;
  c.actors = [...all.map(a => ({ ...a })), { id: `actor${n}`, name: `Actor ${n}`, at: { x: 1, z: laneOf(c).length }, look: "default" }];
}
