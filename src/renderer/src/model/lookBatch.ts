// Editing several looks at once, as several projectiles are (model/batch.ts): for each setting, whether all of them set
// it, some or none, and the value they share - or MIXED where they differ. Setting a value sets it on every one.
import { MIXED, shared } from "./batch";
import { colourChannels, type PackParameter, type Rgb, stageCueValue } from "./looks";
import type { LookCue } from "./types";

export type Across<T> = { sets: "all" | "some" | "none"; value: T | typeof MIXED | null };

const setsOf = (count: number, of: number): Across<never>["sets"] => count === 0 ? "none" : count === of ? "all" : "some";

/** A setting across the looks: how many set it, and the value those that do share. */
export function settingAcross(cues: readonly LookCue[], parameter: PackParameter): Across<number> {
  const values = cues.map(cue => stageCueValue(cue, parameter)).filter((v): v is number => v !== undefined);
  return { sets: setsOf(values.length, cues.length), value: values.length ? shared(values, v => v) : null };
}

/** A colour across the looks: how many set any of its channels, and the colour those that do share. */
export function colourAcross(cues: readonly LookCue[], colour: string): Across<Rgb> {
  const channels = colourChannels(colour);
  const setting = cues.filter(cue => channels.some(p => stageCueValue(cue, p) !== undefined));
  const value = setting.length ? shared(setting, cue => channels.map(p => stageCueValue(cue, p) ?? p.default).join(",")) : null;
  return { sets: setsOf(setting.length, cues.length), value: value === null || value === MIXED ? value : value.split(",").map(Number) as Rgb };
}

export const fadeAcross = (cues: readonly LookCue[]) => shared(cues, cue => cue.fade ?? 0);
export const modeAcross = (cues: readonly LookCue[]) => shared(cues, cue => cue.off ? "off" : "set");
export const packAcross = (cues: readonly LookCue[]) => shared(cues, cue => cue.pack.trim());

/** The value a setting is given when it's ticked for looks that don't all set it: the one they share, else the first's, else the default. */
export function valueToSet(cues: readonly LookCue[], parameter: PackParameter): number {
  const across = settingAcross(cues, parameter);
  if (typeof across.value === "number") return across.value;
  return cues.map(cue => stageCueValue(cue, parameter)).find((v): v is number => v !== undefined) ?? parameter.default;
}
