// Chart looks: RumbleReShaded pack cues over time, blended exactly as the mod's LookTimeline does, and
// BossBattles Stage - the pack the editor knows - previewed with its shader's maths for one pixel.
import stageManifest from "$data/packs/BossBattlesStage.json";
import { evTime } from "./chart";
import { round, type Tempo } from "./tempo";
import type { LoadedChart, LookCue } from "./types";

export type PackParameter = { property: string; label: string; default: number; min: number; max: number; group?: string; colour?: string };
export type PackManifest = { name: string; parameters: PackParameter[] };

export const STAGE_PACK: PackManifest = stageManifest;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// RumbleReShaded matches a parameter by its label or shader property, ignoring case, spaces and underscores.
const comparableParameterName = (name: string) => name.toLowerCase().replace(/[\s_]/g, "");

export function findPackParameter(pack: PackManifest, name: string): PackParameter | undefined {
  const wanted = comparableParameterName(name);
  return pack.parameters.find(p => comparableParameterName(p.label) === wanted || comparableParameterName(p.property) === wanted);
}

export const isCueForPack = (cue: LookCue, pack: PackManifest): boolean => (cue.pack ?? "").trim().toLowerCase() === pack.name.toLowerCase();

export const settingsWrittenIn = (cue: LookCue): [string, number][] =>
  Object.entries(cue.set ?? {}).filter((entry): entry is [string, number] => typeof entry[1] === "number");

// The same refusals as the mod's ChartLoader.ReadVisuals: a cue with any of these is not run.
export function lookCueProblems(cue: LookCue, index: number, tempo: Tempo): string[] {
  const path = `visuals[${index}]`, problems: string[] = [];
  if (cue.t != null && cue.beat != null) problems.push(`${path} has both t and beat - use one`);
  else if (cue.beat != null && !tempo.ok) problems.push(`${path}.beat needs the chart's bpm`);
  else if (cue.t == null && cue.beat == null) problems.push(`${path} needs a time: t (seconds) or beat`);
  else if (evTime(cue, tempo) < 0) problems.push(`${path}.t cannot be negative (got ${round(evTime(cue, tempo), 3)})`);
  if (!cue.pack?.trim()) problems.push(`${path} needs a pack - a RumbleReShaded pack's name, e.g. "UltraShade"`);
  const off = cue.off ?? false, setsSomething = settingsWrittenIn(cue).length > 0;
  if (off && setsSomething) problems.push(`${path} has both "off" and "set" - an off fades the pack back to the player's own settings`);
  if (!off && !setsSomething && cue.on !== true) problems.push(`${path} needs "set" (parameter values), "on": true or "off": true`);
  if ((cue.fade ?? 0) < 0) problems.push(`${path}.fade cannot be negative (got ${cue.fade})`);
  return problems;
}

// Not load errors - the chart still loads - but RumbleReShaded ignores unknown settings and clamps values.
export function stageCueWarnings(cue: LookCue): string[] {
  if (!isCueForPack(cue, STAGE_PACK)) return [];
  const warnings: string[] = [];
  for (const [name, value] of settingsWrittenIn(cue)) {
    const parameter = findPackParameter(STAGE_PACK, name);
    if (!parameter) warnings.push(`"${name}" is not a ${STAGE_PACK.name} setting - it does nothing`);
    else if (value < parameter.min || value > parameter.max) warnings.push(`${parameter.label} ${value} is outside ${parameter.min} to ${parameter.max} - it is clamped`);
  }
  return warnings;
}

export function lookCueTimeLabel(cue: LookCue): string {
  if (cue.beat != null) return `beat ${cue.beat}`;
  return cue.t != null ? `${cue.t} s` : "no time";
}

export type TimedLookCue = { index: number; time: number; pack: string; set: [string, number][]; off: boolean; fade: number };

export function timedLookCues(chart: LoadedChart, tempo: Tempo): TimedLookCue[] {
  return (chart.visuals ?? [])
    .map((cue, index) => ({ cue, index }))
    .filter(({ cue, index }) => lookCueProblems(cue, index, tempo).length === 0)
    .map(({ cue, index }) => ({
      index, time: evTime(cue, tempo), pack: cue.pack.trim(), set: settingsWrittenIn(cue), off: cue.off ?? false, fade: cue.fade ?? 0,
    }))
    .sort((a, b) => a.time - b.time || a.index - b.index);
}

export type PackLookNow = { on: boolean; values: Map<string, number> };

// A port of the mod's LookTimeline.Evaluate: each cue fades from the look so far, frozen where the next
// cue cut in; "off" fades back to the player's own values and only then turns the pack off.
export function evaluateLooksAt(cues: TimedLookCue[], time: number, playerValue: (pack: string, setting: string) => number): Map<string, PackLookNow> {
  const cuesByPack = new Map<string, TimedLookCue[]>();
  for (const cue of cues) {
    if (cue.time > time) continue;
    const packKey = cue.pack.toLowerCase();
    if (!cuesByPack.has(packKey)) cuesByPack.set(packKey, []);
    cuesByPack.get(packKey)!.push(cue);
  }

  const looks = new Map<string, PackLookNow>();
  for (const [packKey, packCues] of cuesByPack) {
    const packName = packCues[0].pack;
    const values = new Map<string, { name: string; value: number }>();
    let on = false;
    packCues.forEach((cue, i) => {
      const cueEnd = i + 1 < packCues.length ? packCues[i + 1].time : time;
      const progress = cue.fade <= 0 ? 1 : clamp((cueEnd - cue.time) / cue.fade, 0, 1);
      const targets: [string, number][] = cue.off ? [...values.values()].map(v => [v.name, playerValue(packName, v.name)]) : cue.set;
      for (const [name, target] of targets) {
        const key = name.toLowerCase(), existing = values.get(key);
        const from = existing?.value ?? playerValue(packName, name);
        values.set(key, { name: existing?.name ?? name, value: from + (target - from) * progress });
      }
      on = !cue.off || progress < 1;
      if (cue.off && progress >= 1) values.clear();
    });
    looks.set(packKey, { on, values: new Map([...values.values()].map(v => [v.name, v.value])) });
  }
  return looks;
}

// The editor assumes the player's own Stage settings are the pack's defaults.
const stagePlayerValue = (_pack: string, setting: string) => findPackParameter(STAGE_PACK, setting)?.default ?? 0;

export type StageSettings = Record<string, number>;

export const stageDefaults = (): StageSettings => Object.fromEntries(STAGE_PACK.parameters.map(p => [p.property, p.default]));

export function stageSettingsFrom(values: Map<string, number> | undefined): StageSettings {
  const settings = stageDefaults();
  for (const [name, value] of values ?? []) {
    const parameter = findPackParameter(STAGE_PACK, name);
    if (parameter) settings[parameter.property] = clamp(value, parameter.min, parameter.max);
  }
  return settings;
}

export type StageLook = { on: boolean; settings: StageSettings };

export function stageLookAt(cues: TimedLookCue[], time: number): StageLook {
  const look = evaluateLooksAt(cues, time, stagePlayerValue).get(STAGE_PACK.name.toLowerCase());
  return { on: look?.on ?? false, settings: stageSettingsFrom(look?.values) };
}

export type StageCueNow = { cue: TimedLookCue; progress: number } | null;

// The Stage cue the look is following at a time, and how far through its fade it is.
export function stageCueAt(cues: TimedLookCue[], time: number): StageCueNow {
  const stageCues = cues.filter(c => c.pack.toLowerCase() === STAGE_PACK.name.toLowerCase() && c.time <= time);
  const cue = stageCues.at(-1);
  if (!cue) return null;
  return { cue, progress: cue.fade <= 0 ? 1 : clamp((time - cue.time) / cue.fade, 0, 1) };
}

// What a cue starts from: every earlier cue, at the cue's own time.
export function stageLookBeforeCue(cues: TimedLookCue[], cueIndex: number): StageLook {
  const position = cues.findIndex(c => c.index === cueIndex);
  if (position < 0) return { on: false, settings: stageDefaults() };
  return stageLookAt(cues.slice(0, position), cues[position].time);
}

// ---- One pixel through the Stage shader -----------------------------------------------------------

export type Rgb = [number, number, number];

// Rodrigues' rotation about the grey axis, by -key hue, so the key hue lands on red (the shader's ToKeySpace).
export function toKeySpace([r, g, b]: Rgb, keyHueDegrees: number): Rgb {
  const angle = -keyHueDegrees * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle), k = 1 / Math.sqrt(3);
  const towardsGrey = k * k * (r + g + b) * (1 - cos);
  return [r * cos + k * (b - g) * sin + towardsGrey, g * cos + k * (r - b) * sin + towardsGrey, b * cos + k * (g - r) * sin + towardsGrey];
}

export const keyness = (keyed: Rgb, strictness: number) => clamp((keyed[0] - Math.max(keyed[1], keyed[2])) * strictness, 0, 1);
export const mix = (a: Rgb, b: Rgb, amount: number): Rgb => [a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount, a[2] + (b[2] - a[2]) * amount];

export const stageColour = (s: StageSettings, prefix: string): Rgb => [s[`_${prefix}R`], s[`_${prefix}G`], s[`_${prefix}B`]];

// The screen's centre (no vignette or danger edges), between beats, with the glow's blur seeing the same
// colour all around - so the blurred key is the pixel's own. depthMetres null is the sky.
export function shadeCentrePixelLikeStage(scene: Rgb, depthMetres: number | null, s: StageSettings): Rgb {
  const keyed = toKeySpace(scene, s._KeyHue);
  const key = keyness(keyed, s._KeyStrictness) * s._KeyKeep;

  const luma = 0.2126 * scene[0] + 0.7152 * scene[1] + 0.0722 * scene[2];
  const tint = mix([1, 1, 1], stageColour(s, "Tint"), s._TintAmount);
  const darkening = 1 - 0.75 * s._Darkness;
  const drained = mix([luma, luma, luma], scene, s._Saturation).map((v, i) => v * darkening * tint[i]) as Rgb;
  const kept = scene.map(v => v * (1 + 0.3 * s._Glow)) as Rgb;
  let colour = mix(drained, kept, key).map(v => Math.max(0, (v - 0.18) * s._Contrast + 0.18)) as Rgb;

  if (s._FogDensity > 0.0001) {
    const fog = depthMetres == null ? s._SkyFog : 1 - Math.exp(-s._FogDensity * Math.max(0, depthMetres - s._FogStart));
    colour = mix(colour, stageColour(s, "Fog"), fog * (1 - s._FogKeyResist * key));
  }

  if (s._Glow > 0.001 && s._GlowRadius > 0.001) {
    const blurredKey = keyness(keyed, s._KeyStrictness) * keyed[0] * s._KeyKeep;
    const glow = stageColour(s, "Glow");
    colour = colour.map((v, i) => v + glow[i] * blurredKey * s._Glow) as Rgb;
  }
  return colour;
}

export function hueToRgb(hueDegrees: number, saturation: number, value: number): Rgb {
  const f = (n: number) => { const k = (n + hueDegrees / 60) % 6; return value - value * saturation * Math.max(0, Math.min(k, 4 - k, 1)); };
  return [f(5), f(3), f(1)];
}

export type StagePreview = { surroundings: string; keyColoured: string; sky: string };

const SURROUNDINGS: Rgb = [0.18, 0.17, 0.15];
const SURROUNDINGS_DEPTH_METRES = 8;
const SKY: Rgb = [0.3, 0.45, 0.7];

// Three swatches of how the look treats a scene: the arena around you, something in the key colour, the sky.
export function stagePreview(look: StageLook): StagePreview {
  const keyColoured = hueToRgb(look.settings._KeyHue, 0.9, 0.7);
  const shade = (scene: Rgb, depth: number | null) => look.on ? shadeCentrePixelLikeStage(scene, depth, look.settings) : scene;
  return {
    surroundings: linearToCss(shade(SURROUNDINGS, SURROUNDINGS_DEPTH_METRES)),
    keyColoured: linearToCss(shade(keyColoured, SURROUNDINGS_DEPTH_METRES)),
    sky: linearToCss(shade(SKY, null)),
  };
}

export const linearToSrgb = (v: number) => { const c = clamp(v, 0, 1); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const srgbToLinear = (v: number) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;

export function linearToCss(colour: Rgb): string {
  return "#" + colour.map(v => Math.round(linearToSrgb(v) * 255).toString(16).padStart(2, "0")).join("");
}

export function cssToLinear(hex: string): Rgb {
  const channel = (at: number) => round(srgbToLinear(parseInt(hex.slice(at, at + 2), 16) / 255), 3);
  return [channel(1), channel(3), channel(5)];
}

// ---- Editing Stage cues ---------------------------------------------------------------------------

// A cue in beats when the chart's other cues are, else in seconds; it sets nothing yet, so it is "on".
export function newStageCue(chart: LoadedChart, time: number, tempo: Tempo): LookCue {
  const visuals = chart.visuals ?? [];
  const inBeats = tempo.ok && (visuals.length ? visuals.some(v => v.beat != null) : chart.events.some(e => e.beat != null));
  const when = inBeats ? { beat: round(tempo.beat(time), 4) } : { t: round(time, 3) };
  return { ...when, pack: STAGE_PACK.name, on: true, fade: 1 } as LookCue;
}

// A cue that sets something is on by setting it; one that sets nothing needs "on": true to load.
function keepCueLoadable(cue: LookCue): void {
  if (settingsWrittenIn(cue).length) delete cue.on;
  else { delete cue.set; if (!cue.off) cue.on = true; }
}

export function setStageCueSetting(cue: LookCue, parameter: PackParameter, value: number | undefined): void {
  const set: Record<string, number | undefined> = { ...(cue.set ?? {}) };
  for (const name of Object.keys(set)) if (findPackParameter(STAGE_PACK, name) === parameter) delete set[name];
  if (value !== undefined) set[parameter.label] = round(value, 4);
  cue.set = set;
  keepCueLoadable(cue);
}

export const colourChannels = (colour: string): PackParameter[] => STAGE_PACK.parameters.filter(p => p.colour === colour);

export function setStageCueColour(cue: LookCue, colour: string, rgb: Rgb | undefined): void {
  colourChannels(colour).forEach((parameter, channel) => setStageCueSetting(cue, parameter, rgb?.[channel]));
}

export function cueSetsParameter(cue: LookCue, parameter: PackParameter): boolean {
  return settingsWrittenIn(cue).some(([name]) => findPackParameter(STAGE_PACK, name) === parameter);
}

export function stageCueValue(cue: LookCue, parameter: PackParameter): number | undefined {
  return settingsWrittenIn(cue).find(([name]) => findPackParameter(STAGE_PACK, name) === parameter)?.[1];
}

export type ParameterGroup = { name: string; settings: PackParameter[]; colours: string[] };

export function stageParameterGroups(): ParameterGroup[] {
  const groups: ParameterGroup[] = [];
  for (const parameter of STAGE_PACK.parameters) {
    const name = parameter.group ?? "Other";
    let group = groups.find(g => g.name === name);
    if (!group) groups.push(group = { name, settings: [], colours: [] });
    if (!parameter.colour) group.settings.push(parameter);
    else if (!group.colours.includes(parameter.colour)) group.colours.push(parameter.colour);
  }
  return groups;
}

// Where a cue's fade ends: what it started from with its own settings on top; "off" is the player's own.
export function stageLookAfterCue(before: StageLook, cue: LookCue): StageLook {
  if (cue.off) return { on: false, settings: stageDefaults() };
  const settings = { ...before.settings };
  for (const [name, value] of settingsWrittenIn(cue)) {
    const parameter = findPackParameter(STAGE_PACK, name);
    if (parameter) settings[parameter.property] = clamp(value, parameter.min, parameter.max);
  }
  return { on: true, settings };
}
