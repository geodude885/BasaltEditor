// Converters: ways to make a chart's looks from something else - a music video and its song, for now. Each one says
// what it reads, what it can be told (its options, drawn by the editor as they are described here), and which of the
// pack's settings it makes and which it leaves alone, and why - so a new converter is one more entry in
// LOOK_CONVERTERS, and the editor shows it without being changed. They are pure: the store reads their inputs
// (store/converting.svelte.ts) and adds what they make to the chart.
import { STAGE_PACK } from "../model/looks";
import type { Tempo } from "../model/tempo";
import type { LookCue } from "../model/types";
import type { FrameFeatures } from "./frames";
import type { SongRhythm } from "./looks";
import { videoConverter } from "./videoConverter";

/** What a converter is given: the video's frames, measured; the chart's song, analysed, if it has one; and the tempo. */
export type ConverterInputs = {
  frames: FrameFeatures[];
  song: SongRhythm | null;
  tempo: Tempo;
  /** Where the video starts in the chart, in seconds: a frame `t` seconds in is at `t + videoStart`. */
  videoStart: number;
};

/** Something a converter can be told, drawn by the editor: a number on a slider, or some of a set of choices. */
export type ConverterOption =
  | { id: string; kind: "number"; label: string; help: string; min: number; max: number; step: number; default: number }
  | { id: string; kind: "choices"; label: string; help: string; choices: readonly string[]; default: readonly string[] };
export type OptionValues = Record<string, number | readonly string[]>;

/** One of the pack's settings, as a converter treats it: whether it makes it, and how - or why it leaves it alone. */
export type SettingCoverage = { property: string; made: boolean; how: string };

export type LookConverter = {
  id: string;
  name: string;
  /** A sentence on what it makes, and from what. */
  description: string;
  /** Whether it listens to the chart's song when the chart has one; it always reads a video. */
  usesSong: boolean;
  options: readonly ConverterOption[];
  /** Every setting of the pack it makes looks for, in the pack's order. */
  coverage: readonly SettingCoverage[];
  generate(inputs: ConverterInputs, options: OptionValues): LookCue[];
};

export const LOOK_CONVERTERS: readonly LookConverter[] = [videoConverter];

export const findConverter = (id: string): LookConverter => LOOK_CONVERTERS.find(c => c.id === id) ?? LOOK_CONVERTERS[0];

export const defaultOptions = (converter: LookConverter): OptionValues =>
  Object.fromEntries(converter.options.map(option => [option.id, option.default]));

/** A converter's coverage by the pack's groups, with each colour's three channels as one entry, for the editor to list. */
export type CoverageGroup = { group: string; made: { name: string; how: string }[]; left: { name: string; how: string }[] };
export function coverageByGroup(converter: LookConverter): CoverageGroup[] {
  const groups = new Map<string, CoverageGroup>();
  for (const { property, made, how } of converter.coverage) {
    const parameter = STAGE_PACK.parameters.find(p => p.property === property);
    if (!parameter) continue;
    const group = groups.get(parameter.group ?? "Other") ?? groups.set(parameter.group ?? "Other", { group: parameter.group ?? "Other", made: [], left: [] }).get(parameter.group ?? "Other")!;
    const list = made ? group.made : group.left, name = parameter.colour ?? parameter.label;
    if (!list.some(entry => entry.name === name)) list.push({ name, how });
  }
  return [...groups.values()];
}
