// What the live link (store/liveLink.svelte.ts) shows in the game: the looks at a moment of the chart.
import type { LiveLinkLook, LiveLinkPack } from "../../../shared/api";
import { comparableParameterName, evaluateLooksAt, type TimedLookCue } from "./looks";
import type { Tempo } from "./tempo";

/**
 * What Basalt tells the shaders during a battle, for the moment at `time`, so the game shows the beat as it would:
 * Beat pulse and flash, the lights' strobe, chase and sweep. Health stays full - no damage or hit shows - and there
 * are no flash limits, so flashing is as the chart has it. Without a tempo the beat is left out (null puts it back
 * to 0), as the mod leaves it.
 */
export function beatGlobals(time: number, tempo: Tempo): Record<string, number | null> {
  const at = Math.max(0, time), globals: Record<string, number | null> = { "basalt.running": 1, "basalt.time": at, "basalt.health": 1 };
  if (!tempo.ok) return { ...globals, "basalt.beat": null, "basalt.beatNumber": null, "basalt.beatsPerSecond": null };
  const beat = tempo.beat(at), whole = Math.floor(beat);
  return {
    ...globals,
    "basalt.beat": beat - whole,
    "basalt.beatNumber": whole,
    "basalt.beatsPerSecond": 1 / Math.max(1e-3, tempo.seconds(whole + 1) - tempo.seconds(whole)),
  };
}

/** A slider's value as the player has it, which a look fades from. The game says; 0 for one it doesn't know. */
export function playerValueIn(packs: LiveLinkPack[]): (pack: string, setting: string) => number {
  return (pack, setting) => {
    const wanted = comparableParameterName(setting), found = packs.find(p => p.name.toLowerCase() === pack.toLowerCase() || p.id.toLowerCase() === pack.toLowerCase());
    return found?.parameters.find(p => comparableParameterName(p.property) === wanted || comparableParameterName(p.label) === wanted)?.player ?? 0;
  };
}

/**
 * The moment to show. Paused inside the selected look's fade, that's where the fade ends: at its start,
 * where selecting it seeks to, nothing has faded in and moving a slider would show nothing.
 */
export function shownTime(cues: TimedLookCue[], playhead: number, playing: boolean, selectedCue: number): number {
  const cue = cues.find(c => c.index === selectedCue);
  return !playing && cue && playhead >= cue.time && playhead <= cue.time + cue.fade ? cue.time + cue.fade : playhead;
}

/** The look on each pack at a time, by the pack's name in the chart. A pack that's off is the player's own: it isn't listed. */
export function looksToShow(cues: TimedLookCue[], time: number, packs: LiveLinkPack[]): LiveLinkLook[] {
  const looks = evaluateLooksAt(cues, time, playerValueIn(packs)), out: LiveLinkLook[] = [];
  for (const [key, look] of looks) {
    if (!look.on) continue;
    const pack = cues.find(c => c.pack.toLowerCase() === key)!.pack;
    out.push({ pack, on: true, values: Object.fromEntries(look.values) });
  }
  return out;
}
