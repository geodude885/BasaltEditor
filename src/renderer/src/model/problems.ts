// The mod's own checks that a chart maker hits most - the game will not load a chart that fails one.
import { actorsOf, endOf, evTime, laneOf, phaseTime } from "./chart";
import { NEWEST_FORMAT, STRUCTURES } from "./constants";
import { lookCueProblems } from "./looks";
import { round, type Tempo } from "./tempo";
import { performanceProblems } from "./performances";
import type { LoadedChart } from "./types";

export function problems(c: LoadedChart, tp: Tempo): string[] {
  const out: string[] = [], L = laneOf(c);
  const ids = new Set(actorsOf(c).map(a => a.id));
  if ((c.format ?? 1) > NEWEST_FORMAT) out.push(`format ${c.format} is newer than the mod reads (${NEWEST_FORMAT})`);
  if (L.length <= 2) out.push("lane.length must be over 2 m");
  if (L.width <= 0) out.push("lane.width must be over 0");
  if (c.bpm != null && !tp.ok) out.push("bpm must be a number over 0");
  if (c.bpmChanges?.length && c.bpm == null) out.push("bpmChanges needs a bpm to start from");
  (c.bpmChanges ?? []).forEach((b, i, all) => {
    if (!(b.bpm > 0)) out.push(`bpmChanges[${i}].bpm must be over 0`);
    if (!(b.beat > (all[i - 1]?.beat ?? 0))) out.push(`bpmChanges[${i}].beat must be after the tempo before it`);
  });
  actorsOf(c).forEach((a, i) => {
    if (a.at && !(a.at.z >= 0 && a.at.z <= L.length)) out.push(`actors[${i}].at.z (${a.at.z}) must be within the lane: 0 to ${L.length}`);
  });
  const phases = c.phases ?? [];
  phases.forEach((p, i) => {
    if (i === 0 && phaseTime(p, tp) !== 0) out.push("phases[0] must start at 0");
    if (i > 0 && phaseTime(p, tp) <= phaseTime(phases[i - 1], tp)) out.push(`phases[${i}] must start after phases[${i - 1}]`);
  });
  c.events.forEach((e, i) => {
    const p = `events[${i}]`, t = evTime(e, tp);
    const kinds = (["projectile", "move", "at"] as const).filter(k => e[k] != null).length;
    if (kinds !== 1) out.push(`${p} needs exactly one of projectile, move or at`);
    if (!Number.isFinite(t)) out.push(`${p} needs a time (t, or beat with a bpm)`);
    if (e.actor != null && !ids.has(e.actor)) out.push(`${p}.actor "${e.actor}" is not one of the actors`);
    const s = e.projectile;
    if (s) {
      if (!STRUCTURES.includes(s.structure)) out.push(`${p}.projectile.structure "${s.structure}" is not a structure`);
      const f: Partial<typeof s.from> = s.from ?? {};
      // Shots may start outside the lane - past the far end or off the sides - up to 6 m (ChartLoader.ProjectileReach).
      if (!(f.z! > 0 && f.z! <= L.length + 6)) out.push(`${p}.projectile.from.z must be over 0 and up to ${L.length + 6} (the lane, or 6 m past it)`);
      if (Math.abs(f.x || 0) > L.width / 2 + 6) out.push(`${p}.projectile.from.x must be within 6 m of the lane's sides`);
      if (f.y! < 0) out.push(`${p}.projectile.from.y is below the floor`);
      if (!(s.speed > 0)) out.push(`${p}.projectile.speed must be over 0`);
      const tel = s.telegraph ?? 0.5;
      if (tel < 0) out.push(`${p}.projectile.telegraph cannot be negative`);
      else if (t - tel < 0) out.push(`${p} would appear before the battle starts`);
      if (s.grounded != null && typeof s.grounded !== "boolean") out.push(`${p}.projectile.grounded must be true or false`);
    }
    if (e.at && !(e.at.z >= 0 && e.at.z <= L.length)) out.push(`${p}.at.z must be within the lane`);
  });
  const last = Math.max(0, ...c.events.map(e => evTime(e, tp)).filter(Number.isFinite));
  if (c.end != null && c.end < last) out.push(`end (${c.end}) is before the last event (${round(last, 2)})`);
  out.push(...performanceProblems(c, tp));
  if (c.playerZone?.length != null && !(c.playerZone.length > 0 && c.playerZone.length <= L.length)) out.push(`playerZone.length must be over 0 and up to the lane's length (${L.length})`);
  if (c.playerZone?.height != null && c.playerZone.height < 1) out.push("playerZone.height must be at least 1 m");
  if (c.rules?.playerSpawns != null && !["all", "discs", "none"].includes(String(c.rules.playerSpawns).toLowerCase())) out.push("rules.playerSpawns must be all, discs or none");
  if (c.music?.file && !/\.(ogg|mp3)$/i.test(c.music.file)) out.push("music.file must be .ogg or .mp3");
  (c.shaders ?? []).forEach((cue, i) => out.push(...lookCueProblems(cue, i, tp)));
  return out;
}

export type Density = { shots: number; average: number; peak: number; moves: number };

/** Projectiles a second, overall and at the busiest two seconds - a rough difficulty. */
export function density(c: LoadedChart, tp: Tempo): Density {
  const shots = c.events.filter(e => e.projectile).map(e => evTime(e, tp)).filter(Number.isFinite).sort((a, b) => a - b);
  const length = Math.max(1, endOf(c, tp));
  let peak = 0;
  for (let i = 0, j = 0; i < shots.length; i++) {
    while (shots[i] - shots[j] > 2) j++;
    peak = Math.max(peak, (i - j + 1) / 2);
  }
  return { shots: shots.length, average: shots.length / length, peak, moves: c.events.filter(e => e.move != null).length };
}
