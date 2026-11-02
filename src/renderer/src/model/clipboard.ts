// What Copy keeps and Paste makes: events and looks, each by how long after the earliest of them it
// comes, so a section pastes whole.
import { evTime, setEvTime } from "./chart";
import type { Tempo } from "./tempo";
import type { ChartEvent, LookCue } from "./types";

export type Copied = { offset: number; event: ChartEvent } | { offset: number; cue: LookCue };

const copyOf = <T>(item: T): T => JSON.parse(JSON.stringify(item)) as T;

/** Copies of these, away from the chart. Anything with no time yet can't be placed, so it's left out. */
export function copyItems(events: ChartEvent[], cues: LookCue[], tp: Tempo): Copied[] {
  const timed = <T extends { t?: number; beat?: number }>(items: T[]) => items.filter(item => Number.isFinite(evTime(item, tp)));
  const shownEvents = timed(events), shownCues = timed(cues);
  const earliest = Math.min(...[...shownEvents, ...shownCues].map(item => evTime(item, tp)));
  return [
    ...shownEvents.map(event => ({ offset: evTime(event, tp) - earliest, event: copyOf(event) })),
    ...shownCues.map(cue => ({ offset: evTime(cue, tp) - earliest, cue: copyOf(cue) })),
  ];
}

/** New events and looks from what was copied, with the earliest at `at`. */
export function pasteItems(copied: Copied[], at: number, tp: Tempo): { events: ChartEvent[]; cues: LookCue[] } {
  const events: ChartEvent[] = [], cues: LookCue[] = [];
  for (const item of copied) {
    if ("event" in item) {
      const event = copyOf(item.event);
      setEvTime(event, at + item.offset, tp);
      events.push(event);
    } else {
      const cue = copyOf(item.cue);
      setEvTime(cue, at + item.offset, tp);
      cues.push(cue);
    }
  }
  return { events, cues };
}
