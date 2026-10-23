// What the toolbar, keys and canvases do. Each edit goes through doc.change, so it can be undone and
// lands in the chart's text.
import { actorSpotAt, actorsOf, endOf, evTime, firstActorId, laneOf, setEvTime } from "../model/chart";
import { straightProjectile, xOfColumn } from "../model/columns";
import { barAround, projectilesBetween } from "../model/ranges";
import { addPhaseAt, mirror, newTimed } from "../model/edits";
import { newStageCue } from "../model/looks";
import { round } from "../model/tempo";
import type { Point } from "../model/chart";
import type { ChartEvent, Projectile } from "../model/types";
import { MOST_EXTRA_TIMELINE_HEIGHT_PIXELS, type TimelineRow } from "../views/timeline/geometry";
import { doc } from "./document.svelte";
import { editor } from "./editor.svelte";
import { seek, songLength } from "./playback";

let toastTimer = 0;
export function toast(text: string): void {
  editor.toast = { text, id: (editor.toast?.id ?? 0) + 1 };
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { editor.toast = null; }, 3500);
}

// ---- Selection --------------------------------------------------------------------------------

export function select(i: number, add: boolean): void {
  if (!add) editor.selection.clear();
  if (editor.selection.has(i) && add) editor.selection.delete(i);
  else editor.selection.add(i);
  editor.selectedPhase = -1;
}

/** Selects the projectiles in a span of time, saying how many; `where` finishes "Selected 4 projectiles …". */
export function selectProjectilesBetween(from: number, to: number, where: string): void {
  const found = projectilesBetween(doc.chart.events, doc.tempo, from, to);
  editor.setSelection(found);
  editor.selectedPhase = -1;
  toast(found.length ? `Selected ${found.length} projectile${found.length === 1 ? "" : "s"} ${where}` : `No projectiles ${where}`);
}

export function selectBar(): void {
  const [from, to] = barAround(doc.tempo, editor.time);
  selectProjectilesBetween(from, to, "in this bar");
}

export const selectToEnd = (): void => selectProjectilesBetween(editor.time, Infinity, "from the playhead on");
export const selectAll = (): void => selectProjectilesBetween(-Infinity, Infinity, "in the chart");

/** The selected events themselves, which keep their identity when the list is re-sorted. */
const chosen = (): ChartEvent[] => [...editor.selection].map(i => doc.chart.events[i]).filter(Boolean);
/** Selects these events again wherever sorting has put them. */
const reselect = (events: ChartEvent[]) => editor.setSelection(events.map(e => doc.chart.events.indexOf(e)).filter(i => i >= 0));

let lastPick: { where: string; x: number; y: number } | null = null;
/** Of the events under a point, the next one along if the same spot was just clicked - so a stack can be stepped through. */
export function pickCycled(under: number[], where: string, x: number, y: number): number {
  let pick = under[0];
  if (lastPick && lastPick.where === where && Math.hypot(lastPick.x - x, lastPick.y - y) < 4 && editor.selection.size === 1) {
    const at = under.indexOf([...editor.selection][0]);
    if (at >= 0) pick = under[(at + 1) % under.length];
  }
  lastPick = { where, x, y };
  return pick;
}

// ---- Adding -----------------------------------------------------------------------------------

/** Adds an event and selects it. */
function insert(ev: ChartEvent): void {
  let added: ChartEvent | undefined;
  doc.change(["events"], () => {
    doc.chart.events.push(ev);
    // The list holds its own (reactive) copy - keep that, not `ev`, to find it after sorting.
    added = doc.chart.events.at(-1);
  });
  editor.selectedPhase = -1;
  reselect([added!]);
}

export function addProjectile(at?: Point): void {
  const c = doc.chart, L = laneOf(c), first = actorsOf(c)[0];
  const base = at ?? actorSpotAt(c, first, editor.time, doc.tempo);
  // Late enough for its warning: a projectile appears its telegraph before it flies.
  const ev = newTimed(c, Math.max(editor.time, 0.2), doc.tempo, editor.snap);
  ev.projectile = {
    structure: "Disc",
    from: { x: round(base.x, 1), y: 0, z: round(Math.max(0.5, Math.min(L.length, base.z - (at ? 0 : 1))), 1) },
    to: "player", speed: 10, telegraph: 0.2, by: first.id,
  };
  insert(ev);
}

/** Adds a projectile flying straight down the lane from a column across it, at a time (snapped). */
export function addProjectileInColumn(seconds: number, column: number): void {
  const c = doc.chart, ev = newTimed(c, seconds, doc.tempo, editor.snap);
  ev.projectile = straightProjectile(c, xOfColumn(column, laneOf(c).width), firstActorId(c));
  insert(ev);
}

export function addMove(): void {
  const ev = newTimed(doc.chart, editor.time, doc.tempo, editor.snap);
  ev.move = "Straight";
  insert(ev);
}

export function addPhase(): void {
  let index = -1;
  doc.change(["phases"], () => { index = addPhaseAt(doc.chart, doc.tempo.snap(editor.time, editor.snap), doc.tempo); });
  selectPhase(index);
}

// ---- Editing the selection ----------------------------------------------------------------------

/** Edits the one selected event, keeping it selected wherever sorting moves it. */
export function editSelected(mutate: (e: ChartEvent) => void): void {
  const e = chosen()[0];
  if (!e) return;
  doc.change(["events"], () => mutate(e));
  reselect([e]);
}

/** Edits every selected projectile at once - one undo step - keeping them selected. */
export function editSelectedProjectiles(mutate: (p: Projectile) => void): void {
  const events = chosen().filter(e => e.projectile);
  if (!events.length) return;
  doc.change(["events"], () => events.forEach(e => mutate(e.projectile!)));
  reselect(events);
}

export function removeSelected(): void {
  if (!editor.selection.size) return;
  const gone = new Set(editor.selection);
  doc.change(["events"], () => { doc.chart.events = doc.chart.events.filter((_, i) => !gone.has(i)); });
  editor.selection.clear();
}

export function mirrorSelected(): void {
  const events = chosen();
  if (!events.length) return;
  doc.change(["events"], () => mirror(events));
  reselect(events);
}

/** Moves the selection by the snap (a bar with `bar`); with nothing selected, moves the playhead. */
export function nudge(dir: -1 | 1, bar: boolean): void {
  const tp = doc.tempo, beats = bar ? 4 : (editor.snap || 1);
  const step = (t: number) => tp.ok ? tp.seconds(tp.beat(t) + dir * beats) - t : dir * (bar ? 2 : 0.5);
  const events = chosen();
  if (!events.length) { seek(Math.max(0, tp.snap(editor.time + step(editor.time), editor.snap))); return; }
  doc.change(["events"], () => events.forEach(e => setEvTime(e, tp.snap(evTime(e, tp) + step(evTime(e, tp)), editor.snap), tp)));
  reselect(events);
}

/** Moves the selected projectile to where its thrower stands when it flies. */
export function throwFromActor(): void {
  const e = chosen()[0], s = e?.projectile;
  if (!s) return;
  const actor = actorsOf(doc.chart).find(a => a.id === s.by) ?? actorsOf(doc.chart)[0];
  const at = actorSpotAt(doc.chart, actor, evTime(e, doc.tempo), doc.tempo);
  editSelected(() => { s.from.x = at.x; s.from.z = round(Math.max(0.5, at.z - 1), 1); });
}

let clipboard: { offset: number; event: ChartEvent }[] | null = null;
export function copySelected(): void {
  const events = chosen();
  if (!events.length) return;
  const t0 = Math.min(...events.map(e => evTime(e, doc.tempo)));
  clipboard = events.map(e => ({ offset: evTime(e, doc.tempo) - t0, event: JSON.parse(JSON.stringify(e)) as ChartEvent }));
  toast(`Copied ${events.length} - Ctrl+V pastes at the playhead`);
}

export function paste(): void {
  if (!clipboard) return;
  const at = doc.tempo.snap(editor.time, editor.snap), made: ChartEvent[] = [];
  doc.change(["events"], () => {
    for (const c of clipboard!) {
      const e = structuredClone(c.event);
      setEvTime(e, at + c.offset, doc.tempo);
      doc.chart.events.push(e);
      made.push(doc.chart.events.at(-1)!);
    }
  });
  reselect(made);
}

// ---- History and the chart as a whole -----------------------------------------------------------

export function undo(): void { if (doc.undo()) editor.selection.clear(); }
export function redo(): void { if (doc.redo()) editor.selection.clear(); }

/** Opens a chart's text, fitting the timeline to it. */
export function loadChart(text: string, name: string): void {
  doc.load(text, name);
  editor.selection.clear();
  editor.selectedPhase = -1;
  editor.time = 0;
  fit();
}

/** Zooms the timeline to show the whole chart. */
export function fit(): void {
  const w = editor.timelineWidth || 800;
  editor.view.pps = Math.max(12, Math.min(200, (w - 40) / Math.max(4, endOf(doc.chart, doc.tempo) + 1)));
  editor.view.t0 = -0.5;
}

/** Zooms the timeline about a point (its middle by default). */
export function zoom(factor: number, atX = editor.timelineWidth / 2): void {
  const v = editor.view, anchor = atX / v.pps + v.t0;
  v.pps = Math.max(8, Math.min(600, v.pps * factor));
  v.t0 = Math.max(-1, anchor - atX / v.pps);
}

export function endWithSong(): void {
  const length = songLength();
  if (length == null) return;
  const end = round(length, 2);
  doc.change(["end"], () => { doc.chart.end = end; });
  toast(`The battle now ends with the song, at ${end} s`);
}

export function tap(): void {
  const now = performance.now(), times = editor.tapTimes;
  const kept = times.length && now - times[times.length - 1] > 2500 ? [] : times;
  editor.tapTimes = [...kept, now].slice(-16);
}
export function tapBpm(): number {
  const t = editor.tapTimes;
  return t.length < 2 ? 0 : 60000 * (t.length - 1) / (t[t.length - 1] - t[0]);
}

// ---- Look cues --------------------------------------------------------------------------------

export function selectLookCue(index: number): void {
  editor.selectedLookCue = index;
  editor.selection.clear();
  editor.selectedPhase = -1;
  editor.tab = "looks";
}

export function addStageCueAtPlayhead(): void {
  const time = doc.tempo.snap(editor.time, editor.snap);
  let index = -1;
  doc.change(["visuals"], () => {
    doc.chart.visuals ??= [];
    doc.chart.visuals.push(newStageCue(doc.chart, time, doc.tempo));
    index = doc.chart.visuals.length - 1;
  });
  selectLookCue(index);
}

export function removeLookCue(index: number): void {
  doc.change(["visuals"], () => {
    doc.chart.visuals?.splice(index, 1);
    if (!doc.chart.visuals?.length) delete doc.chart.visuals;
  });
  editor.selectedLookCue = -1;
}

export function selectPhase(index: number): void {
  editor.selectedPhase = index;
  editor.selection.clear();
  editor.tab = "phases";
}

export function toggleTimelineRow(row: TimelineRow): void {
  if (editor.collapsedTimelineRows.has(row)) editor.collapsedTimelineRows.delete(row);
  else editor.collapsedTimelineRows.add(row);
  editor.rememberTimelineLayout();
}

export function setExtraTimelineHeight(pixels: number): void {
  editor.extraTimelineHeightPixels = Math.round(Math.max(0, Math.min(MOST_EXTRA_TIMELINE_HEIGHT_PIXELS, pixels)));
}
