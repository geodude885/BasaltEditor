// What the toolbar, keys and canvases do. Each edit goes through doc.change, so it can be undone and
// lands in the chart's text.
import { actorSpotAt, actorsOf, endOf, evTime, laneOf, setEvTime } from "../model/chart";
import { copyItems, pasteItems, type Copied } from "../model/clipboard";
import { projectileAt, templateOf, xOfColumn } from "../model/columns";
import { barAround, projectilesBetween } from "../model/ranges";
import { addPhaseAt, mirror, newTimed } from "../model/edits";
import { newStageCue } from "../model/looks";
import { round } from "../model/tempo";
import type { Point } from "../model/chart";
import type { ChartEvent, LookCue, Projectile } from "../model/types";
import { MOST_EXTRA_TIMELINE_HEIGHT_PIXELS, type TimelineRow } from "../views/timeline/geometry";
import { doc } from "./document.svelte";
import { display } from "./display.svelte";
import { editing } from "./editing.svelte";
import { transport } from "./transport.svelte";
import { ui } from "./ui.svelte";
import { seek, songLength } from "./playback";

let toastTimer = 0;
export function toast(text: string): void {
  ui.toast = { text, id: (ui.toast?.id ?? 0) + 1 };
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { ui.toast = null; }, 3500);
}

// ---- Selection --------------------------------------------------------------------------------

export function select(i: number, add: boolean): void {
  if (!add) editing.clearSelection();
  if (editing.selection.has(i) && add) editing.selection.delete(i);
  else editing.selection.add(i);
  editing.selectedPhase = -1;
}

/** Selects the projectiles in a span of time, saying how many; `where` finishes "Selected 4 projectiles …". */
export function selectProjectilesBetween(from: number, to: number, where: string): void {
  const found = projectilesBetween(doc.chart.events, doc.tempo, from, to);
  editing.selectedLooks.clear();
  editing.setSelection(found);
  editing.selectedPhase = -1;
  toast(found.length ? `Selected ${found.length} projectile${found.length === 1 ? "" : "s"} ${where}` : `No projectiles ${where}`);
}

export function selectBar(): void {
  const [from, to] = barAround(doc.tempo, transport.time);
  selectProjectilesBetween(from, to, "in this bar");
}

export const selectToEnd = (): void => selectProjectilesBetween(transport.time, Infinity, "from the playhead on");
export const selectAll = (): void => selectProjectilesBetween(-Infinity, Infinity, "in the chart");

/** The selected events themselves, which keep their identity when the list is re-sorted. */
const chosen = (): ChartEvent[] => [...editing.selection].map(i => doc.chart.events[i]).filter(Boolean);
/** Selects these events again wherever sorting has put them. */
const reselect = (events: ChartEvent[]) => editing.setSelection(events.map(e => doc.chart.events.indexOf(e)).filter(i => i >= 0));
/** The selected looks themselves, likewise. */
const chosenLooks = (): LookCue[] => [...editing.selectedLooks].map(i => doc.chart.shaders?.[i]).filter((cue): cue is LookCue => !!cue);
const reselectLooks = (cues: LookCue[]) => editing.setLookSelection(cues.map(cue => doc.chart.shaders?.indexOf(cue) ?? -1).filter(i => i >= 0));
/** Selects these events and looks again wherever sorting has put them. */
export function reselectBoth(events: ChartEvent[], cues: LookCue[]): void {
  reselect(events);
  reselectLooks(cues);
}
/** The chart's keys that hold what's selected, or these. */
export const keysOf = (events: readonly unknown[], cues: readonly unknown[]): string[] => [...(events.length ? ["events"] : []), ...(cues.length ? ["shaders"] : [])];

let lastPick: { where: string; x: number; y: number } | null = null;
/** Of the events under a point, the next one along if the same spot was just clicked - so a stack can be stepped through. */
export function pickCycled(under: number[], where: string, x: number, y: number, selected: ReadonlySet<number> = editing.selection): number {
  let pick = under[0];
  if (lastPick && lastPick.where === where && Math.hypot(lastPick.x - x, lastPick.y - y) < 4 && selected.size === 1) {
    const at = under.indexOf([...selected][0]);
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
  editing.selectedPhase = -1;
  reselect([added!]);
}

export function addProjectile(at?: Point): void {
  const c = doc.chart, L = laneOf(c), first = actorsOf(c)[0];
  const base = at ?? actorSpotAt(c, first, transport.time, doc.tempo);
  // Late enough for its warning: a projectile appears its telegraph before it flies.
  const ev = newTimed(c, Math.max(transport.time, 0.2), doc.tempo, editing.snap);
  ev.projectile = {
    structure: "Disc",
    from: { x: round(base.x, 1), y: 0, z: round(Math.max(0.5, Math.min(L.length, base.z - (at ? 0 : 1))), 1) },
    speed: 10, telegraph: 0.2,
  };
  insert(ev);
}

/** Adds a projectile flying straight down the lane from a column across it (out of `count`, five unless given), at a time (snapped). */
export function addProjectileInColumn(seconds: number, column: number, count?: number): void {
  const c = doc.chart, ev = newTimed(c, seconds, doc.tempo, editing.snap);
  ev.projectile = projectileAt(c, xOfColumn(column, laneOf(c).width, count), editing.newProjectile);
  insert(ev);
}

/** New projectiles in a column copy the one selected projectile. */
export function placeLikeSelected(): void {
  const selected = chosen().filter(e => e.projectile);
  if (selected.length !== 1) return;
  editing.placeLike(templateOf(selected[0].projectile!));
  toast(`New projectiles are now like this ${selected[0].projectile!.structure}`);
}

export function addMove(): void {
  const ev = newTimed(doc.chart, transport.time, doc.tempo, editing.snap);
  ev.move = "Straight";
  insert(ev);
}

export function addPhase(): void {
  let index = -1;
  doc.change(["phases"], () => { index = addPhaseAt(doc.chart, doc.tempo.snap(transport.time, editing.snap), doc.tempo); });
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

/** Edits every selected projectile's event at once - one undo step - keeping them selected. */
export function editSelectedProjectileEvents(mutate: (e: ChartEvent) => void): void {
  const events = chosen().filter(e => e.projectile);
  if (!events.length) return;
  doc.change(["events"], () => events.forEach(mutate));
  reselect(events);
}

/** Edits every selected projectile at once. */
export const editSelectedProjectiles = (mutate: (p: Projectile) => void): void => editSelectedProjectileEvents(e => mutate(e.projectile!));

export function removeSelected(): void {
  if (!editing.hasSelection) return;
  const gone = new Set(editing.selection), goneLooks = new Set(editing.selectedLooks);
  doc.change(keysOf([...gone], [...goneLooks]), () => {
    if (gone.size) doc.chart.events = doc.chart.events.filter((_, i) => !gone.has(i));
    if (!goneLooks.size) return;
    doc.chart.shaders = doc.chart.shaders?.filter((_, i) => !goneLooks.has(i));
    if (!doc.chart.shaders?.length) delete doc.chart.shaders;
  });
  editing.clearSelection();
}

export function mirrorSelected(): void {
  const events = chosen();
  if (!events.length) return;
  doc.change(["events"], () => mirror(events));
  reselect(events);
}

/** Moves the selection by the snap (a bar with `bar`); with nothing selected, moves the playhead. */
export function nudge(dir: -1 | 1, bar: boolean): void {
  const tp = doc.tempo, beats = bar ? 4 : (editing.snap || 1);
  const step = (t: number) => tp.ok ? tp.seconds(tp.beat(t) + dir * beats) - t : dir * (bar ? 2 : 0.5);
  const events = chosen(), cues = chosenLooks();
  if (!events.length && !cues.length) { seek(Math.max(0, tp.snap(transport.time + step(transport.time), editing.snap))); return; }
  doc.change(keysOf(events, cues), () => [...events, ...cues].forEach(e => setEvTime(e, tp.snap(evTime(e, tp) + step(evTime(e, tp)), editing.snap), tp)));
  reselectBoth(events, cues);
}

/** Moves the selected projectile to where its thrower stands when it flies. */
export function throwFromActor(): void {
  const e = chosen()[0], s = e?.projectile;
  if (!s) return;
  const actor = actorsOf(doc.chart).find(a => a.id === e.actor) ?? actorsOf(doc.chart)[0];
  const at = actorSpotAt(doc.chart, actor, evTime(e, doc.tempo), doc.tempo);
  editSelected(() => { s.from.x = at.x; s.from.z = round(Math.max(0.5, at.z - 1), 1); });
}

let clipboard: Copied[] = [];
export function copySelected(): void {
  const copied = copyItems(chosen(), chosenLooks(), doc.tempo);
  if (!copied.length) return;
  clipboard = copied;
  toast(`Copied ${copied.length}`);
}

export function paste(): void {
  if (!clipboard.length) return;
  const { events, cues } = pasteItems(clipboard, doc.tempo.snap(transport.time, editing.snap), doc.tempo);
  const madeEvents: ChartEvent[] = [], madeCues: LookCue[] = [];
  doc.change(keysOf(events, cues), () => {
    for (const e of events) {
      doc.chart.events.push(e);
      madeEvents.push(doc.chart.events.at(-1)!);
    }
    for (const cue of cues) {
      (doc.chart.shaders ??= []).push(cue);
      madeCues.push(doc.chart.shaders.at(-1)!);
    }
  });
  reselectBoth(madeEvents, madeCues);
}

// ---- History and the chart as a whole -----------------------------------------------------------

export function undo(): void { if (doc.undo()) editing.clearSelection(); }

/** Two fingers tapped the editor: undo, and say so - a gesture has no button to see go. */
export function undoByTouch(): void {
  const could = doc.canUndo;
  undo();
  toast(could ? "Undone" : "Nothing to undo");
  globalThis.navigator?.vibrate?.(10);
}
export function redo(): void { if (doc.redo()) editing.clearSelection(); }

/** Opens a chart's text, fitting the timeline to it. */
export function loadChart(text: string, name: string): void {
  doc.load(text, name);
  editing.clearSelection();
  editing.selectedPhase = -1;
  transport.time = 0;
  fit();
}

/** Zooms the timeline to show the whole chart. */
export function fit(): void {
  const w = display.timelineWidth || 800;
  display.timeline.pps = Math.max(12, Math.min(200, (w - 40) / Math.max(4, endOf(doc.chart, doc.tempo) + 1)));
  display.timeline.t0 = -0.5;
}

/** Zooms the timeline about a point (its middle by default). */
export function zoom(factor: number, atX = display.timelineWidth / 2): void {
  const v = display.timeline, anchor = atX / v.pps + v.t0;
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
  const now = performance.now(), times = ui.tapTimes;
  const kept = times.length && now - times[times.length - 1] > 2500 ? [] : times;
  ui.tapTimes = [...kept, now].slice(-16);
}
export function tapBpm(): number {
  const t = ui.tapTimes;
  return t.length < 2 ? 0 : 60000 * (t.length - 1) / (t[t.length - 1] - t[0]);
}

// ---- Look cues --------------------------------------------------------------------------------

export function selectLookCue(index: number): void {
  editing.clearSelection();
  editing.selectedLooks.add(index);
  editing.selectedPhase = -1;
  ui.revealTab("looks");
}

/** A press on a look: selects it, or with `add` adds it to the selection or takes it out. */
export function selectLook(index: number, add: boolean): void {
  if (!add) { selectLookCue(index); return; }
  if (!editing.selectedLooks.delete(index)) editing.selectedLooks.add(index);
  editing.selectedPhase = -1;
}

/** Edits every selected look the same way, as one undo step, keeping them selected wherever they sort to. */
export function editSelectedLooks(mutate: (cue: LookCue) => void): void {
  const cues = chosenLooks();
  if (!cues.length) return;
  doc.change(["shaders"], () => { for (const cue of cues) mutate(cue); });
  reselectLooks(cues);
}

/** Edits one look, keeping it selected wherever a new time sorts it to. */
export function editLookCue(index: number, mutate: (cue: LookCue) => void): void {
  const cue = doc.chart.shaders?.[index];
  if (!cue) return;
  doc.change(["shaders"], () => mutate(cue));
  reselectLooks([cue]);
}

export function addStageCueAtPlayhead(): void {
  const time = doc.tempo.snap(transport.time, editing.snap);
  let made: LookCue | undefined;
  doc.change(["shaders"], () => {
    doc.chart.shaders ??= [];
    doc.chart.shaders.push(newStageCue(doc.chart, time, doc.tempo));
    made = doc.chart.shaders.at(-1);
  });
  selectLookCue(doc.chart.shaders!.indexOf(made!));
}

export function removeLookCue(index: number): void {
  doc.change(["shaders"], () => {
    doc.chart.shaders?.splice(index, 1);
    if (!doc.chart.shaders?.length) delete doc.chart.shaders;
  });
  editing.selectedLooks.clear();
}

export function selectPhase(index: number): void {
  editing.selectedPhase = index;
  editing.clearSelection();
  ui.revealTab("phases");
}

export function toggleTimelineRow(row: TimelineRow): void {
  if (display.collapsedTimelineRows.has(row)) display.collapsedTimelineRows.delete(row);
  else display.collapsedTimelineRows.add(row);
  display.rememberTimelineLayout();
}

export function setExtraTimelineHeight(pixels: number): void {
  display.extraTimelineHeightPixels = Math.round(Math.max(0, Math.min(MOST_EXTRA_TIMELINE_HEIGHT_PIXELS, pixels)));
}
