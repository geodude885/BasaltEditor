// Changes to a chart that are more than setting one field. Each mutates the chart it is given and
// returns the top-level keys it touched, for the document to write back into the text.
import { actorsOf, coloursOf, laneOf, phaseTime, withAlpha } from "./chart";
import { round, type Tempo } from "./tempo";
import type { ChartEvent, LaneColours, LoadedChart, TempoChange } from "./types";

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

// ---- Settings that are more than one field ------------------------------------------------------

const isEmptyValue = (value: unknown) => value === undefined || value === "" || (typeof value === "number" && Number.isNaN(value));

export function setTopLevelValueOrRemoveIfEmpty<K extends keyof LoadedChart>(c: LoadedChart, key: K, value: LoadedChart[K] | undefined | ""): void {
  if (isEmptyValue(value)) delete c[key];
  else c[key] = value as LoadedChart[K];
}

// Writes "colours", dropping the American "colors" the mod also reads, so only one is left.
export function setLaneColours(c: LoadedChart, next: LaneColours): void {
  delete c.colors;
  if (Object.keys(next).length) c.colours = next; else delete c.colours;
}

export function setLaneColour(c: LoadedChart, key: string, value: string | undefined): void {
  const next: Record<string, string | undefined> = { ...coloursOf(c) };
  if (value) next[key] = value; else delete next[key];
  setLaneColours(c, next as LaneColours);
}

export function setWallsShown(c: LoadedChart, show: boolean, colour: string, opacity: number): void {
  const next = { ...coloursOf(c) };
  if (show) next.walls = withAlpha(colour, opacity || 0.2); else delete next.walls;
  setLaneColours(c, next);
}

export function setZone(c: LoadedChart, lengthMetres: number | undefined, heightMetres: number | undefined): void {
  const zone: { length?: number; height?: number } = {};
  if (lengthMetres != null) zone.length = lengthMetres;
  if (heightMetres != null) zone.height = heightMetres;
  if (Object.keys(zone).length) c.zone = zone; else delete c.zone;
}

export function setRules(c: LoadedChart, spawn: string, cleanupSeconds: number | undefined): void {
  const rules = { ...(c.rules ?? {}) };
  if (spawn === "all") delete rules.spawn; else rules.spawn = spawn as "discs" | "none";
  if (cleanupSeconds == null) delete rules.cleanup; else rules.cleanup = Math.max(0, cleanupSeconds);
  if (Object.keys(rules).length) c.rules = rules; else delete c.rules;
}

// A spot needs both x and z; with either missing the lane is laid across the arena's middle.
export function setArenaSpot(c: LoadedChart, x: number | undefined, z: number | undefined, facingDegrees: number | undefined): void {
  const arena = { ...(c.arena ?? { map: "here" as const }) };
  if (x != null && z != null) arena.at = { x, z }; else delete arena.at;
  if (facingDegrees != null) arena.facing = facingDegrees; else delete arena.facing;
  c.arena = arena;
}

export function setMusic(c: LoadedChart, file: string, startSeconds: number, volume: number): void {
  if (!file.trim()) { delete c.music; return; }
  c.music = { file: file.trim(), start: startSeconds || 0, volume: Math.min(1, Math.max(0, Number.isNaN(volume) ? 1 : volume)) };
}
