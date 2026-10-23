// Practice tools, in either layout: stepping back, jumping back to where playing started, the A-B
// loop and pre-roll - and how stretched the highway is. The sums are in model/practice.ts.
import { DEFAULT_HIGHWAY_PPS } from "../views/highway/geometry";
import { barsBefore, loopBetween } from "../model/practice";
import { selectProjectilesBetween } from "./actions";
import { doc } from "./document.svelte";
import { editor } from "./editor.svelte";
import { play, seek } from "./playback";
import { recording } from "./recording.svelte";

class PracticeState {
  /** The A-B loop playing goes round, in chart time, or null. */
  loop = $state<readonly [number, number] | null>(null);
  /** A loop's first point, once set and until the second is. */
  loopStart = $state<number | null>(null);
  /** Where playing last started, to jump back to. */
  playFrom = $state(0);
  /** Start a bar early when playing, to hear the music lead in. */
  preroll = $state(false);
  /** How stretched the highway is: pixels a second. */
  highwayPps = $state(DEFAULT_HIGHWAY_PPS);
}

export const practice = new PracticeState();

// Replace mode clears the loop, when there is one, rather than just first tap to last.
recording.replaceSpan = () => practice.loop;

/** Plays or pauses, remembering where playing started - a bar early with pre-roll on. */
export function playOrPause(): void {
  if (!editor.playing) {
    practice.playFrom = editor.time;
    if (practice.preroll) seek(barsBefore(doc.tempo, editor.time, 1));
  }
  play();
}

export function rewindBars(bars: number): void {
  seek(Math.max(practice.loop?.[0] ?? 0, barsBefore(doc.tempo, editor.time, bars)));
}

export function rewindSeconds(seconds: number): void {
  seek(Math.max(0, editor.time - seconds));
}

export function backToPlayStart(): void {
  seek(practice.playFrom);
}

/** Sets the loop's first point, then its second; with a loop already, clears it. */
export function loopPoint(): void {
  if (practice.loop) { practice.loop = null; practice.loopStart = null; return; }
  if (practice.loopStart == null) { practice.loopStart = editor.time; return; }
  practice.loop = loopBetween(practice.loopStart, editor.time);
  practice.loopStart = null;
}

/** What the loop button says it will do next. */
export const loopPointLabel = (): string => (practice.loop ? "Loop off" : practice.loopStart != null ? "Set B" : "Loop A");

/** Selects the projectiles in the A-B loop. */
export function selectLoop(): void {
  if (practice.loop) selectProjectilesBetween(practice.loop[0], practice.loop[1], "in the loop");
}

/** Keeps a playing loop going round: past its end, back to its start. App.svelte calls it every frame. */
export function keepLooping(): void {
  const loop = practice.loop;
  if (loop && editor.playing && editor.time >= loop[1]) seek(loop[0]);
}
