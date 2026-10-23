// The phone layout's practice tools: stepping back, jumping back to where playing started, the A-B
// loop and pre-roll. The sums are in model/practice.ts.
import { barsBefore, loopBetween } from "../model/practice";
import { selectProjectilesBetween } from "./actions";
import { doc } from "./document.svelte";
import { editor } from "./editor.svelte";
import { mobile } from "./mobile.svelte";
import { play, seek } from "./playback";
import { recording } from "./recording.svelte";

// Replace mode clears the loop, when there is one, rather than just first tap to last.
recording.replaceSpan = () => mobile.loop;

/** Plays or pauses, remembering where playing started - a bar early with pre-roll on. */
export function playOrPause(): void {
  if (!editor.playing) {
    mobile.playFrom = editor.time;
    if (mobile.preroll) seek(barsBefore(doc.tempo, editor.time, 1));
  }
  play();
}

export function rewindBars(bars: number): void {
  seek(Math.max(mobile.loop?.[0] ?? 0, barsBefore(doc.tempo, editor.time, bars)));
}

export function rewindSeconds(seconds: number): void {
  seek(Math.max(0, editor.time - seconds));
}

export function backToPlayStart(): void {
  seek(mobile.playFrom);
}

/** Sets the loop's first point, then its second; with a loop already, clears it. */
export function loopPoint(): void {
  if (mobile.loop) { mobile.loop = null; mobile.loopStart = null; return; }
  if (mobile.loopStart == null) { mobile.loopStart = editor.time; return; }
  mobile.loop = loopBetween(mobile.loopStart, editor.time);
  mobile.loopStart = null;
}

/** Selects the projectiles in the A-B loop. */
export function selectLoop(): void {
  if (mobile.loop) selectProjectilesBetween(mobile.loop[0], mobile.loop[1], "in the loop");
}

/** Keeps a playing loop going round: past its end, back to its start. Called every frame by the layout. */
export function keepLooping(): void {
  const loop = mobile.loop;
  if (loop && editor.playing && editor.time >= loop[1]) seek(loop[0]);
}
