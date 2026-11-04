// A projectile's fields, described once: the inspector draws them for one projectile and the batch inspector for
// several, so a new field added here shows in both. Each says how to read it, how to write it, when it applies, and
// whether several projectiles can share it - their times and places across the lane stay their own, as one value
// would stack them on one spot (they're moved relatively instead: dragging, Mirror, columns).
import { aimOf, setAim, setAimMode, setOffset } from "./batch";
import { actorsOf, firstActorId, isGrounded, onFloor } from "./chart";
import { GROUNDED_STATE, STRUCTURES } from "./constants";
import { round } from "./tempo";
import type { ChartEvent, LoadedChart, Projectile, Structure } from "./types";

type Base = {
  id: string;
  label: string;
  help?: string;
  /** Fields with the same row are laid out side by side. */
  row: number;
  /** Several projectiles can be given one value of it. */
  together: boolean;
  /** It applies to this projectile (for several, to every one of them). */
  applies?: (p: Projectile) => boolean;
  /** It's shown but can't be changed for this projectile, with a word on why (in place of its value). */
  fixed?: (p: Projectile) => string | null;
};
export type NumberField = Base & { kind: "number"; step: number; min?: number; read: (p: Projectile) => number; write: (p: Projectile, n: number) => void; slider?: { min: number; max: number } };
export type ChoiceField = Base & {
  kind: "choice";
  choices: (chart: LoadedChart) => { value: string; label: string }[];
  read: (e: ChartEvent, chart: LoadedChart) => string;
  write: (e: ChartEvent, value: string, chart: LoadedChart) => void;
};
export type CheckField = Base & { kind: "check"; read: (p: Projectile) => boolean; write: (p: Projectile, on: boolean) => void; note?: (p: Projectile) => string };
export type ProjectileField = NumberField | ChoiceField | CheckField;

const atYou = (p: Projectile) => !p.to, atAPoint = (p: Projectile) => !!p.to;

export const PROJECTILE_FIELDS: readonly ProjectileField[] = [
  {
    id: "structure", label: "Structure", kind: "choice", row: 0, together: true,
    choices: () => STRUCTURES.map(s => ({ value: s, label: s })),
    read: e => e.projectile!.structure, write: (e, v) => { e.projectile!.structure = v as Structure; },
  },
  { id: "fromX", label: "From x", kind: "number", step: 0.1, row: 1, together: false, read: p => +(p.from?.x ?? 0), write: (p, n) => { p.from.x = round(n, 2); } },
  {
    id: "height", label: "Height y", kind: "number", step: 0.1, min: 0, row: 1, together: true, slider: { min: 0, max: 3 },
    read: p => +(p.from?.y ?? 0), write: (p, n) => { p.from.y = round(Math.max(0, n), 2); },
    fixed: p => onFloor(p) ? (isGrounded(p) ? "grounded" : "on the floor") : null,
  },
  { id: "fromZ", label: "From z", kind: "number", step: 0.1, min: 0.5, row: 1, together: true, read: p => +(p.from?.z ?? 10), write: (p, n) => { p.from.z = round(Math.max(0.5, n), 2); } },
  {
    id: "grounded", label: "Grounded", help: "Thrown along the floor, for more damage", kind: "check", row: 2, together: true,
    read: p => isGrounded(p),
    write: (p, on) => { if (on === GROUNDED_STATE.includes(p.structure)) delete p.grounded; else p.grounded = on; },
    note: p => GROUNDED_STATE.includes(p.structure) ? ` (default for a ${p.structure})` : "",
  },
  {
    id: "aim", label: "Aim", kind: "choice", row: 3, together: true,
    choices: () => [{ value: "player", label: "At you" }, { value: "straight", label: "Straight down the lane" }, { value: "point", label: "At a point" }],
    read: e => aimOf(e.projectile!),
    write: (e, v) => {
      const p = e.projectile!;
      if (v === "player" || v === "straight") setAim(p, v);
      // A point other than straight ahead: the middle of your end, unless it already aims at one.
      else if (aimOf(p) !== "point") { setAimMode(p, "point"); p.to = { x: 0, y: p.to?.y ?? 1.3 }; }
    },
  },
  { id: "aimX", label: "Aim x", kind: "number", step: 0.1, row: 3, together: false, applies: atAPoint, read: p => +(p.to?.x ?? 0), write: (p, n) => { if (p.to) p.to.x = round(n, 2); } },
  {
    id: "aimY", label: "Aim y", kind: "number", step: 0.1, row: 3, together: true, applies: atAPoint,
    read: p => +(p.to?.y ?? 1.3), write: (p, n) => { if (p.to) p.to.y = round(n, 2); },
    fixed: p => isGrounded(p) ? "on the floor" : null,
  },
  {
    id: "offsetX", label: "Offset x", help: "Metres to your right, across the lane - whichever way you face", kind: "number", step: 0.05, row: 3, together: true,
    applies: atYou, read: p => +(p.offset?.x ?? 0), write: (p, n) => setOffset(p, { x: n }),
  },
  {
    id: "offsetY", label: "Offset y", help: "Metres up from 0.25 m below your head", kind: "number", step: 0.05, row: 3, together: true,
    applies: atYou, read: p => +(p.offset?.y ?? 0), write: (p, n) => setOffset(p, { y: n }),
    fixed: p => isGrounded(p) ? "ignored" : null,
  },
  { id: "speed", label: "Speed m/s", kind: "number", step: 0.5, min: 0.5, row: 4, together: true, read: p => +p.speed, write: (p, n) => { p.speed = Math.max(0.5, n); } },
  { id: "telegraph", label: "Spawned s before", kind: "number", step: 0.1, min: 0, row: 4, together: true, read: p => +(p.telegraph ?? 0.5), write: (p, n) => { p.telegraph = Math.max(0, n); } },
  {
    id: "actor", label: "Thrown by", kind: "choice", row: 4, together: true,
    choices: chart => actorsOf(chart).map(a => ({ value: a.id ?? "actor", label: a.name || a.id || "Actor" })),
    read: (e, chart) => e.actor ?? firstActorId(chart),
    write: (e, v, chart) => { if (v === firstActorId(chart)) delete e.actor; else e.actor = v; },
  },
];

/** The fields to show for these projectiles: all of them for one; for several, those they can share and that apply to every one. */
export function fieldsFor(events: readonly ChartEvent[]): ProjectileField[] {
  const shots = events.map(e => e.projectile).filter((p): p is Projectile => !!p);
  if (!shots.length) return [];
  return PROJECTILE_FIELDS.filter(f => (shots.length === 1 || f.together) && shots.every(p => f.applies?.(p) ?? true));
}

/** The fields in their rows, in order. */
export function fieldRows(fields: readonly ProjectileField[]): ProjectileField[][] {
  const rows = new Map<number, ProjectileField[]>();
  for (const f of fields) (rows.get(f.row) ?? rows.set(f.row, []).get(f.row)!).push(f);
  return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, row]) => row);
}
