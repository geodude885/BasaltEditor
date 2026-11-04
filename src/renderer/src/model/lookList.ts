// The Looks tab's list, for a chart with a few hundred looks: grouped under the chart's phases (or every eight bars
// without them), each with what it sets, filtered by pack or by what it sets; the look in effect at a time, to follow
// the playhead; and the looks between two in the list, for selecting a run of them.
import { evTime, phaseTime } from "./chart";
import { findPackParameter, isCueForPack, lookCueTimeLabel, settingsWrittenIn, STAGE_PACK } from "./looks";
import { clockText, type Tempo } from "./tempo";
import type { LoadedChart, LookCue } from "./types";

export type LookRow = {
  index: number;
  time: number;
  /** Its time as written: seconds, or a beat. */
  label: string;
  pack: string;
  stage: boolean;
  /** "turns off", "turns on", or how many settings it sets and in which groups. */
  summary: string;
  /** The Stage groups it sets something in. */
  groups: string[];
  fade: number;
};
export type LookSection = { key: string; title: string; rows: LookRow[] };
/** Only looks of this pack, or that set something in this Stage group; null lets all through. */
export type LookFilter = { pack: string | null; group: string | null };

const BARS_A_SECTION = 8, SECONDS_A_SECTION_WITHOUT_TEMPO = 30, GROUPS_NAMED = 3;

/** The Stage groups a look sets something in, in the pack's order. */
export function groupsSetBy(cue: LookCue): string[] {
  if (!isCueForPack(cue, STAGE_PACK)) return [];
  const groups = new Set(settingsWrittenIn(cue).map(([name]) => findPackParameter(STAGE_PACK, name)?.group).filter((g): g is string => !!g));
  return [...new Set(STAGE_PACK.parameters.map(p => p.group ?? ""))].filter(g => groups.has(g));
}

export function lookSummary(cue: LookCue): string {
  if (cue.off) return "turns off";
  const count = settingsWrittenIn(cue).length;
  if (!count) return "turns on";
  const groups = groupsSetBy(cue);
  const named = groups.slice(0, GROUPS_NAMED).join(", ") + (groups.length > GROUPS_NAMED ? ` +${groups.length - GROUPS_NAMED}` : "");
  return `sets ${count}${named ? ` · ${named}` : ""}`;
}

/** The packs the chart's looks are for, in the order they first come. */
export const packsIn = (chart: LoadedChart): string[] => [...new Set((chart.shaders ?? []).map(cue => cue.pack.trim()))];

const passes = (cue: LookCue, filter: LookFilter) =>
  (filter.pack == null || cue.pack.trim().toLowerCase() === filter.pack.toLowerCase()) && (filter.group == null || groupsSetBy(cue).includes(filter.group));

/** The looks that pass the filter, grouped by phase - or by eight bars (thirty seconds without a tempo) for a chart without phases. */
export function lookSections(chart: LoadedChart, tempo: Tempo, filter: LookFilter = { pack: null, group: null }): LookSection[] {
  const phases = (chart.phases ?? []).map((phase, i) => ({ name: phase.name?.trim() || `Phase ${i + 1}`, from: phaseTime(phase, tempo) }))
    .filter(p => Number.isFinite(p.from)).sort((a, b) => a.from - b.from);
  const sectionOf = (time: number): { key: string; title: string } => {
    if (!Number.isFinite(time)) return { key: "untimed", title: "No time" };
    if (phases.length) {
      let at = -1;
      phases.forEach((p, i) => { if (p.from <= time) at = i; });
      return at < 0 ? { key: "before", title: `Before ${phases[0].name}` } : { key: `phase ${at}`, title: `${phases[at].name} · ${clockText(phases[at].from, 1)}` };
    }
    if (tempo.ok) {
      const section = Math.floor(Math.floor(tempo.beat(time) / 4) / BARS_A_SECTION);
      return { key: `bars ${section}`, title: `Bars ${section * BARS_A_SECTION + 1}–${(section + 1) * BARS_A_SECTION}` };
    }
    const section = Math.floor(time / SECONDS_A_SECTION_WITHOUT_TEMPO);
    return { key: `secs ${section}`, title: `${clockText(section * SECONDS_A_SECTION_WITHOUT_TEMPO, 0)}–${clockText((section + 1) * SECONDS_A_SECTION_WITHOUT_TEMPO, 0)}` };
  };

  const sections: LookSection[] = [];
  (chart.shaders ?? []).forEach((cue, index) => {
    if (!passes(cue, filter)) return;
    const time = evTime(cue, tempo), { key, title } = sectionOf(time);
    let section = sections.find(s => s.key === key);
    if (!section) sections.push(section = { key, title, rows: [] });
    section.rows.push({
      index, time, label: lookCueTimeLabel(cue), pack: cue.pack, stage: isCueForPack(cue, STAGE_PACK),
      summary: lookSummary(cue), groups: groupsSetBy(cue), fade: cue.fade ?? 0,
    });
  });
  return sections;
}

/** The look in effect at a time: the last to start by then (looks are kept in time order), or -1 before the first. */
export function lookInEffect(chart: LoadedChart, tempo: Tempo, time: number): number {
  let found = -1;
  (chart.shaders ?? []).forEach((cue, i) => { if (evTime(cue, tempo) <= time) found = i; });
  return found;
}

/** The looks from one row to another in the list as it is shown, both included, whichever comes first. */
export function rowsBetween(sections: LookSection[], from: number, to: number): number[] {
  const order = sections.flatMap(s => s.rows.map(r => r.index));
  const a = order.indexOf(from), b = order.indexOf(to);
  if (a < 0 || b < 0) return [to];
  return order.slice(Math.min(a, b), Math.max(a, b) + 1);
}
