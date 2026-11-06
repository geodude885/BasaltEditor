// How much a look changes, and what each group of BossBattles Stage is doing at a moment - for showing many looks at
// once: the timeline's lanes, a marker sized by its change, the list's impact, and simplifying looks that change little.
// "Felt" is a setting's place in its range as it shows: most settings evenly; glitter and motes, which show strongly well
// before their top, by the square root of their place up to 0.3 (0.025 is barely there, 0.1 plain, 0.2 a lot); a colour
// by how much it shows (a tint colour hardly matters at no tint).
import { STAGE_PACK, stageColour, stageLookAfterCue, stageLookBeforeCue, type PackParameter, type Rgb, type StageSettings, type TimedLookCue } from "./looks";
import type { LookCue } from "./types";

/** The groups, in the pack's order: the timeline's lanes. */
export const LOOK_GROUPS: readonly string[] = [...new Set(STAGE_PACK.parameters.map(p => p.group ?? "Other"))];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const SPARKLE_FULL = 0.3;
const SPARKLE_FELT = new Set(["_Glitter", "_Motes"]);

/** A setting's felt place, 0 to 1. */
export function felt(parameter: PackParameter, value: number): number {
  if (SPARKLE_FELT.has(parameter.property)) return Math.sqrt(clamp01(value / SPARKLE_FULL));
  return clamp01((value - parameter.min) / Math.max(1e-9, parameter.max - parameter.min));
}

/** The settings that say how much each colour shows. */
const COLOUR_SHOWS: Record<string, string[]> = {
  "Tint colour": ["_TintAmount"], "Glow colour": ["_Glow", "_Kaleidoscope"], "Fog colour": ["_FogDensity", "_SkyFog"], "Beat flash colour": ["_BeatFlash"],
  "Vignette colour": ["_Vignette"], "Sparkle colour": ["_Glitter", "_Motes"], "Light colour": ["_Lights"], "Danger colour": ["_HitFlash", "_LowHealth"],
};
const parameterOf = (property: string) => STAGE_PACK.parameters.find(p => p.property === property)!;
const showing = (s: StageSettings, colour: string) => Math.max(0, ...(COLOUR_SHOWS[colour] ?? []).map(p => felt(parameterOf(p), s[p])));

/** How far apart two looks are, felt, for one setting: a colour's channels count by how much the colour shows in either, and each by its weight. */
export function settingDistance(parameter: PackParameter, a: StageSettings, b: StageSettings): number {
  const apart = Math.abs(felt(parameter, a[parameter.property]) - felt(parameter, b[parameter.property])) * weightOf(parameter);
  return parameter.colour ? apart * Math.max(showing(a, parameter.colour), showing(b, parameter.colour)) : apart;
}

/**
 * How much each setting counts in a look's change: the ones that shape a look in full, the ones that only flavour it
 * (how fast things twinkle or sweep, how sharp a pulse is) a third - so their wobble doesn't make a look that looks the
 * same count as a change.
 */
const FLAVOUR = new Set(["_KeyStrictness", "_GlowRadius", "_KaleidoscopeRadius", "_FogStart", "_SkyFog", "_FogKeyResist", "_PulseSharpness",
  "_VignetteSize", "_GlitterDensity", "_GlitterSize", "_MoteRise", "_Twinkle", "_Shimmer", "_BeatSparkle", "_LightBeams", "_LightSweep", "_LightWidth",
  "_LightChase", "_LightStrobeRate"]);
export const weightOf = (p: PackParameter): number => FLAVOUR.has(p.property) ? 1 / 3 : 1;

/** A look as numbers to compare: each setting's felt place, a colour's channels by how much the colour shows, each by its weight. */
export function feltVector(s: StageSettings, parameters: readonly PackParameter[] = STAGE_PACK.parameters): number[] {
  return parameters.map(p => (p.colour ? felt(p, s[p.property]) * showing(s, p.colour) : felt(p, s[p.property])) * weightOf(p));
}

/** How much a look changes: the most any setting moves, felt, overall and in each group. */
export type LookImpact = { total: number; groups: Record<string, number> };

export function impactBetween(before: StageSettings, after: StageSettings, parameters: readonly PackParameter[] = STAGE_PACK.parameters): LookImpact {
  const groups: Record<string, number> = {};
  let total = 0;
  for (const p of parameters) {
    const d = settingDistance(p, before, after), group = p.group ?? "Other";
    groups[group] = Math.max(groups[group] ?? 0, d);
    total = Math.max(total, d);
  }
  return { total, groups };
}

// Kept for each list of cues, which is new whenever the looks change.
const impactsByCues = new WeakMap<TimedLookCue[], Map<number, LookImpact>>();

/**
 * Each Stage look's impact, by its index in the chart: from the look just before it to where its own settings take it.
 * Turning the pack on or off counts as a whole change.
 */
export function lookImpacts(cues: TimedLookCue[]): Map<number, LookImpact> {
  const kept = impactsByCues.get(cues);
  if (kept) return kept;
  const impacts = new Map<number, LookImpact>(), stage = STAGE_PACK.name.toLowerCase();
  for (const cue of cues) {
    if (cue.pack.toLowerCase() !== stage) continue;
    const before = stageLookBeforeCue(cues, cue.index);
    const asCue: LookCue = { pack: cue.pack, off: cue.off || undefined, values: Object.fromEntries(cue.values) };
    const after = stageLookAfterCue(before, asCue);
    if (before.on !== after.on) impacts.set(cue.index, { total: 1, groups: Object.fromEntries(LOOK_GROUPS.map(g => [g, 1])) });
    else impacts.set(cue.index, impactBetween(before.settings, after.settings));
  }
  impactsByCues.set(cues, impacts);
  return impacts;
}

/** Below this, a look's change is small: easy to miss in the game. */
export const SMALL_IMPACT = 0.05;

/** What a group is doing in a look: how much (0 to 1, felt) and in what colour - for a timeline lane. */
export type GroupAmount = { amount: number; colour: Rgb | null };

export function groupAmounts(s: StageSettings): Record<string, GroupAmount> {
  const f = (property: string) => felt(parameterOf(property), s[property]);
  const away = (property: string) => Math.abs(f(property) - felt(parameterOf(property), parameterOf(property).default));
  return {
    // The grade: how far it moves from the scene as it is.
    Colour: { amount: Math.max(away("_Saturation"), f("_Darkness"), away("_Contrast"), f("_TintAmount")), colour: s._TintAmount > 0.02 ? stageColour(s, "Tint") : null },
    Glow: { amount: Math.max(f("_Glow"), f("_Kaleidoscope")), colour: stageColour(s, "Glow") },
    // Fog shows strongly well before its densest, so half its range fills the lane.
    Fog: { amount: Math.min(1, f("_FogDensity") * 2), colour: stageColour(s, "Fog") },
    Beat: { amount: Math.max(f("_BeatPulse"), f("_BeatFlash")), colour: s._BeatFlash > 0.01 ? stageColour(s, "BeatFlash") : null },
    Edges: { amount: f("_Vignette"), colour: stageColour(s, "Vignette") },
    Magic: { amount: Math.max(f("_Glitter"), f("_Motes")), colour: stageColour(s, "Sparkle") },
    Lights: { amount: f("_Lights"), colour: stageColour(s, "Light") },
  };
}
