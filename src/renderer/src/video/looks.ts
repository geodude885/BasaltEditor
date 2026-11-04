// BossBattles Stage looks from a music video: each beat's colours, highlights, haze, specks and motion
// become the Stage settings that do the same thing, and the looks follow them - a cue only when a
// setting moves enough, fading so the look passes through each beat's own at its middle, and cutting
// at once where the video cuts. Deterministic: the same frames always give the same cues.
import { findPackParameter, hueToRgb, setStageCueSetting, STAGE_PACK, type PackParameter, type Rgb } from "../model/looks";
import { round, type Tempo } from "../model/tempo";
import type { LookCue } from "../model/types";
import { hitAt, hitNear, loudnessBetween, usualLoudness, type Rhythm } from "../audio/rhythm";
import { HUE_BINS, type FrameFeatures } from "./frames";
import { snapToQuarterBeats, stepsOf, type Step } from "./steps";

/** The Stage groups a video can drive. Edges is the vignette only: the game sets hit flash and low health. */
export const VIDEO_LOOK_GROUPS = ["Colour", "Glow", "Fog", "Beat", "Edges", "Magic", "Lights"] as const;
export type VideoLookGroup = (typeof VIDEO_LOOK_GROUPS)[number];

export type VideoLookOptions = {
  /** Seconds the video is ahead of the chart: a frame `t` seconds in is at `t + offset` in the chart. */
  offset: number;
  /** 0 leaves every setting at the pack's default, 1 follows the video fully. */
  strength: number;
  /** 0 writes a cue only for big changes, 1 for small ones too. */
  detail: number;
  groups: readonly VideoLookGroup[];
};

export const DEFAULT_VIDEO_LOOK_OPTIONS: VideoLookOptions = { offset: 0, strength: 1, detail: 0.5, groups: VIDEO_LOOK_GROUPS };

/** Settings only the game drives. */
const LEFT_TO_THE_GAME = new Set(["_HitFlash", "_LowHealth", "_DangerR", "_DangerG", "_DangerB"]);
/** How long a cut takes, so it reads as a cut rather than a fade. */
export const CUT_FADE_SECONDS = 0.05;
/** A key hue only changes when another is clearly stronger. */
const HUE_SWITCHES_WHEN_STRONGER = 1.3;
/**
 * More than this many beats a second and the pulse is kept gentler, as it throbs so often. Flashes and strobes go as fast as
 * the music: the player's flashing setting in Basalt is what limits them, or turns them off.
 */
const FAST_BEATS_A_SECOND = 3, PULSE_WHEN_FAST_AT_MOST = 0.6;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const median = (values: number[]) => { const s = [...values].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : 0; };
/** A hue as a vivid colour: the video's colours, strong enough to show through the game's own. */
const VIVID_SATURATION = 0.85;
const vivid = (hue: number, value = 1): Rgb => hueToRgb(hue, VIVID_SATURATION, value);
const chroma = (c: Rgb) => { const m = Math.max(...c); return m > 0 ? (m - Math.min(...c)) / m : 0; };
function hueOfRgb([r, g, b]: Rgb): number {
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  if (d <= 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

type Baseline = { specks: number; blobs: number; motion: number };

/** The chart's song, analysed, and where chart time 0 is in it (music.offset). */
export type SongRhythm = { rhythm: Rhythm; offset: number };
/**
 * What the song does at a step: how hard its kick, snare and hi-hats hit at the step's start, how loud the bar is against
 * the song's usual, and where that loudness ranks in the song (0 the quietest bar, 1 the loudest).
 */
export type SoundAt = { kick: number; snare: number; hat: number; loud: number; rank: number };

/** A cut's look lands on a real hit in the song when there's one this close, else the nearest quarter beat. */
const CUT_FINDS_A_HIT_WITHIN = 0.15;

/**
 * Glitter and motes show on a log scale: 0.01 is a touch, 0.1 is plain, 0.2 a lot. An amount from 0 to 1 is
 * spread over that scale; under a little it's off.
 */
/** Glitter shows from about 0.01 and is plain by 0.25; motes are stronger, plain by 0.1 and a lot at 0.2. */
const GLITTER_SCALE = { least: 0.01, most: 0.3 }, MOTES_SCALE = { least: 0.005, most: 0.2 }, SPARKLE_OFF_UNDER = 0.05;
/** Outside a peak, glitter and motes stay smaller: at most this far up their scale (glitter about 0.1, motes 0.05). */
const SPARKLE_USUALLY_AT_MOST = 0.7;
type SparkleScale = { least: number; most: number };
export const sparkleAmount = (amount: number, scale: SparkleScale = MOTES_SCALE): number =>
  amount < SPARKLE_OFF_UNDER ? 0 : scale.least * (scale.most / scale.least) ** clamp(amount, 0, 1);
const feltOn = (scale: SparkleScale) => (value: number): number => value <= 0 ? 0 : clamp(Math.log(value / scale.least) / Math.log(scale.most / scale.least), 0, 1);
/**
 * A few bars are the big moments, where glitter or motes go right up: the bars that stand out most for them -
 * the sparkliest and busiest for glitter, the softest and quietest (but still playing) for motes. Sparing, so they land.
 */
const PEAK_BARS_SHARE = 0.08, PEAK_STANDS_OUT = 1.12, PEAK_AMOUNT = 0.9, PLAYING_FROM = 0.15;
export type Peak = { glitter: number; motes: number };

export function peaksOf(steps: Step[], tempo: Tempo, base: Baseline, sounds: (SoundAt | null)[]): Peak[] {
  const barOf = (step: Step) => tempo.ok ? Math.floor(tempo.beat(step.start) / 4) : Math.floor(step.start / 2);
  const scores = steps.map((step, k) => {
    const sound = sounds[k], playing = sound ? sound.loud > PLAYING_FROM : true;
    return {
      bar: barOf(step),
      glitter: step.specks / Math.max(1, base.specks) + (sound ? sound.hat + sound.loud * 0.5 : 0),
      motes: playing ? step.blobs / Math.max(1, base.blobs) + (sound ? clamp(1 - sound.loud, 0, 1) : 0) : 0,
    };
  });
  const peakBars = (kind: "glitter" | "motes", taken = new Set<number>()) => {
    const bars = new Map<number, number[]>();
    for (const s of scores) if (!taken.has(s.bar)) (bars.get(s.bar) ?? bars.set(s.bar, []).get(s.bar)!).push(s[kind]);
    const ranked = [...bars].map(([bar, values]) => ({ bar, score: values.reduce((a, b) => a + b, 0) / values.length })).sort((a, b) => b.score - a.score || a.bar - b.bar);
    const usual = median(ranked.map(r => r.score));
    return new Set(ranked.slice(0, Math.max(1, Math.round(ranked.length * PEAK_BARS_SHARE))).filter(r => r.score > usual * PEAK_STANDS_OUT).map(r => r.bar));
  };
  // Each peak is its own moment: a bar that peaks for glitter does not peak for motes too.
  const glitter = peakBars("glitter"), motes = peakBars("motes", glitter);
  return scores.map(s => ({ glitter: glitter.has(s.bar) ? 1 : 0, motes: motes.has(s.bar) ? 1 : 0 }));
}

/** Settings felt on a log scale: a change in them counts by how it feels, not by how far it moves. */
const FELT: Record<string, (value: number) => number> = { _Glitter: feltOn(GLITTER_SCALE), _Motes: feltOn(MOTES_SCALE) };
/** A step's two strongest hues - the key and the accent - and how much of the frame's colour the key is. */
export type Palette = { hue: number; share: number; accent: number; colourful: number };

/** How much saturated colour a frame has (its hue bins' total) before its hues are trusted: a fade to white has a trace of noise in one hue. */
const COLOURFUL_FROM = 0.04, COLOURFUL_FULLY = 0.2;
const white: Rgb = [1, 1, 1];
const towards = (from: Rgb, to: Rgb, amount: number): Rgb => from.map((v, c) => v + (to[c] - v) * amount) as Rgb;

const BIN_DEGREES = 360 / HUE_BINS;
/** An accent is at least this far round from the key, so it's a different colour rather than a shade of it. */
const ACCENT_APART_BINS = 3;
const around = (bins: number[], bin: number) => bins[(bin + HUE_BINS - 1) % HUE_BINS] + bins[bin] + bins[(bin + 1) % HUE_BINS];
const binsApart = (a: number, b: number) => { const d = Math.abs(a - b) % HUE_BINS; return Math.min(d, HUE_BINS - d); };
// The hue between a bin and its neighbours, by how much of each there is.
function hueAround(bins: number[], bin: number): number {
  let x = 0, y = 0;
  for (const near of [bin - 1, bin, bin + 1]) {
    const b = (near + HUE_BINS) % HUE_BINS, angle = (b + 0.5) * (2 * Math.PI / HUE_BINS);
    x += Math.cos(angle) * bins[b]; y += Math.sin(angle) * bins[b];
  }
  return x || y ? ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360 : (bin + 0.5) * BIN_DEGREES;
}

/**
 * Each step's key hue and accent: the strongest hue, and the strongest well away from it. Each is kept until
 * another is clearly stronger, so two hues sharing a frame don't flip every beat.
 */
export function palettes(steps: Step[]): Palette[] {
  let key = -1, accent = -1, last: Palette | null = null;
  const strongest = (bins: number[], allowed: (bin: number) => boolean) => {
    let best = -1;
    for (let bin = 0; bin < HUE_BINS; bin++) if (allowed(bin) && (best < 0 || around(bins, bin) > around(bins, best))) best = bin;
    return best;
  };
  return steps.map(step => {
    const bins = step.hues, total = bins.reduce((s, v) => s + v, 0);
    const best = strongest(bins, () => true), colourful = clamp((total - COLOURFUL_FROM) / (COLOURFUL_FULLY - COLOURFUL_FROM), 0, 1);
    // A frame with hardly any colour keeps the palette from before.
    if (key >= 0 && colourful === 0) return { ...last!, colourful };
    if (key < 0 || around(bins, best) > around(bins, key) * HUE_SWITCHES_WHEN_STRONGER) key = best;
    const apart = (bin: number) => binsApart(bin, key) >= ACCENT_APART_BINS;
    const bestAccent = strongest(bins, apart);
    if (accent < 0 || !apart(accent) || around(bins, bestAccent) > around(bins, accent) * HUE_SWITCHES_WHEN_STRONGER) accent = bestAccent;
    // With hardly any second colour, the accent is a neighbour of the key rather than noise.
    const accentHue = total > 0 && around(bins, accent) > total * 0.08 ? hueAround(bins, accent) : (hueAround(bins, key) + 40) % 360;
    last = { hue: hueAround(bins, key), share: total > 0 ? around(bins, key) / total : 0, accent: accentHue, colourful };
    return last;
  });
}

/** The key hue of each step - the strongest, kept until another is clearly stronger. */
export const keyHues = (steps: Step[]) => palettes(steps).map(({ hue, share }) => ({ hue, share }));

/**
 * What each Stage setting would be to look like this step, by shader property, before strength. Each effect has
 * a base it always shows at, which the video pushes up or down, and colours are the video's hues made vivid - an
 * average colour or a highlight is close to grey or white, and would hardly show in the game.
 */
export function settingsForStep(step: Step, palette: Palette, base: Baseline, beatsASecond: number, sound: SoundAt | null = null, peak: Peak = { glitter: 0, motes: 0 }): Record<string, number> {
  const s: Record<string, number> = {};
  const colour = (prefix: string, rgb: Rgb) => { s[`_${prefix}R`] = rgb[0]; s[`_${prefix}G`] = rgb[1]; s[`_${prefix}B`] = rgb[2]; };
  // The less colour the frame has, the closer to white its colours are: a fade to white is white.
  const tinted = (rgb: Rgb) => towards(white, rgb, palette.colourful), accent = tinted(vivid(palette.accent));

  // Colour: a vivid video saturates the game more, never less; its key hue tints it and is kept bright through everything.
  // A loud bar lifts the colour and the glow; a quiet one darkens a little.
  const loud = sound ? clamp(sound.loud, 0, 1.6) : 1, quiet = sound ? clamp((1 - sound.loud) / 0.5, 0, 1) : 0;
  s._Saturation = 1 + clamp((step.saturation - 0.2) / 0.35, 0, 1) * 0.5 + (loud - 1) * 0.2;
  s._Contrast = 1 + clamp((step.contrast - 0.22) / 0.12, -1, 1) * 0.4;
  s._Darkness = clamp((0.35 - step.luma) / 0.35, 0, 1) * 0.8 + quiet * 0.15;
  colour("Tint", tinted(vivid(palette.hue)));
  s._TintAmount = (0.25 + clamp(palette.share, 0, 1) * 0.35) * palette.colourful;
  s._KeyHue = palette.hue;
  s._KeyKeep = 0.6 + clamp(palette.share, 0, 1) * 0.4;
  s._KeyStrictness = 2.5;

  // Glow: in the accent colour, stronger the more of the frame is bright.
  colour("Glow", accent);
  s._Glow = (0.5 + step.brightShare * 1.8) * (0.7 + 0.3 * loud);
  s._GlowRadius = 2 + step.brightSoftness * 4;

  // Fog: in the key colour, thicker for a bright or hazy frame; far haze leaves the near lane clear; a flat top fogs the sky.
  const haze = clamp(step.luma * (1 - step.contrast / 0.3), 0, 1);
  // A blast of white in the video whites the arena out with fog too, so a bright climax doesn't read as flat.
  const blast = clamp((step.luma - 0.6) / 0.3, 0, 1);
  s._FogDensity = 0.015 + step.luma * 0.04 + haze * 0.1 + blast * 0.12;
  s._FogStart = clamp((step.bottomContrast - step.topContrast) / Math.max(1e-3, step.bottomContrast), 0, 1) * 20;
  s._SkyFog = 0.4 + clamp(1 - step.topContrast / 0.25, 0, 1) * 0.6;
  colour("Fog", towards(towards(vivid(palette.hue, 0.8), [step.luma, step.luma, step.luma].map(v => clamp(v * 1.2, 0, 1)) as Rgb, 1 - palette.colourful), white, blast * 0.6));

  // Beat: with the song, the pulse is its kick and a hard snare in a loud bar flashes; without, the video's motion. Cuts flash too.
  const moving = step.motion / Math.max(1e-4, base.motion);
  // The pulse goes with how much the bar is going: quiet bars hardly pulse, and a fast song pulses less, as it pulses more often.
  const going = sound ? clamp((sound.loud - 0.4) / 0.8, 0.15, 1) : 1, often = beatsASecond > 2.5 ? 0.7 : 1;
  // A strobing video - brightness swinging between its frames within a step - throbs on the beat, sharper the more it swings.
  const strobe = clamp((step.lumaSwing - 0.25) / 0.4, 0, 1);
  s._BeatPulse = Math.min(beatsASecond > FAST_BEATS_A_SECOND ? PULSE_WHEN_FAST_AT_MOST : 1,
    (sound ? (0.05 + sound.kick * 0.55) * going + clamp(moving, 0, 2) * 0.03 : 0.25 + moving * 0.25) * often + strobe * 0.4);
  // How spiky only counts once there is motion to be spiky: a still frame's noise isn't a sharp pulse.
  s._PulseSharpness = sound ? 6 + sound.kick * 8 + strobe * 4 : 4 + Math.min(3, step.motionPeak / Math.max(1e-4, step.motion) - 1) * 6 * clamp(moving, 0, 1);
  s._BeatFlash = step.flash ? 0.3 + step.flash.strength : step.cut ? 0.2 : sound && sound.snare > 0.8 && sound.loud > 1.1 ? 0.12 : 0;
  colour("BeatFlash", step.flash && chroma(step.flash.colour) > 0.3 ? vivid(hueOfRgb(step.flash.colour)) : accent);

  // Lights: on in the song's loudest bars (its top half or so, fully in its top tenth) and off otherwise - without the song,
  // where the video moves most - in the accent colour;
  // more beams and quicker sweeps the more is going on, sweeping with the tempo, and strobing with the kick.
  const lit = sound ? clamp((sound.rank - 0.55) / 0.35, 0, 1) : clamp((moving - 1.2) / 1.5, 0, 1);
  s._Lights = lit * 1.2;
  s._LightBeams = 3 + Math.round(lit * 3);
  s._LightSweep = clamp((beatsASecond || 2) / 4, 0.2, 1) * (0.5 + 0.5 * lit);
  s._LightWidth = 0.07 + quiet * 0.08;
  // Strobe snaps the lights on with the strong kicks of a loud bar; the chase lights a different few lamps each beat, more
  // as the bar builds.
  s._LightStrobe = sound && lit > 0.5 && sound.kick > 0.5 ? clamp(sound.kick, 0, 1) * 0.8 : 0;
  s._LightChase = lit > 0.3 ? Math.min(0.85, lit * 0.7 + (sound && sound.snare > 0.6 ? 0.2 : 0)) : 0;
  s._LightStrobeRate = 1;
  colour("Light", accent);
  // Strongly lit bars put the lights first: the stage darkens a little, so the beams show.
  s._Darkness += clamp(lit - 0.7, 0, 0.3) * 0.4;

  // A light show in the video - a dark stage, its brightness swinging hard between frames - makes the lights the focus: the
  // arena goes dark, the beams go thin and quick like lasers, all the lamps strobe at the video's own rate, and a little
  // haze shows them.
  const beats = Math.max(0.25, (step.end - step.start) * (beatsASecond || 2)), flashesABeat = step.lumaJumps / beats;
  const show = clamp((step.lumaSwing - 0.2) / 0.3, 0, 1) * clamp((0.3 - step.lumaLow) / 0.2, 0, 1) * (flashesABeat >= 0.5 ? 1 : 0);
  if (show > 0.15) {
    s._Darkness = Math.max(s._Darkness, 0.45 + show * 0.35);
    s._TintAmount *= 1 - show * 0.5;
    s._Lights = Math.max(s._Lights, 1.2 + show * 0.6);
    s._LightBeams = Math.max(s._LightBeams, 6 + Math.round(show * 2));
    s._LightWidth += (0.03 - s._LightWidth) * Math.min(1, show * 2);
    s._LightSweep = Math.max(s._LightSweep, 1 + show);
    s._LightStrobe = Math.max(s._LightStrobe, 0.6 + show * 0.4);
    s._LightStrobeRate = flashesABeat < 1.25 ? 1 : flashesABeat < 3 ? 2 : 4;
    s._LightChase = Math.max(s._LightChase, 0.6);
    s._FogDensity = Math.max(s._FogDensity, 0.03);
  }

  // Edges: always a little, more for a video that darkens its own edges, in the shadows' hue - or the key's when they're grey.
  s._Vignette = 0.25 + clamp(step.vignette, 0, 0.4) * 1.5;
  colour("Vignette", vivid(chroma(step.shadow) > 0.25 ? hueOfRgb(step.shadow) : palette.hue, 0.35));

  // Magic: glitter where the video has more specks than usual or the song's hi-hats are busy; motes where it has more soft
  // blobs or the song goes quiet - so both come and go, on their log scale, in the accent colour.
  const sparkly = clamp((step.specks / Math.max(1, base.specks) - 1.1) / 1.5, 0, 1), blobby = clamp((step.blobs / Math.max(1, base.blobs) - 1.1) / 1.5, 0, 1);
  s._Glitter = sparkleAmount(Math.max(peak.glitter * PEAK_AMOUNT, Math.min(SPARKLE_USUALLY_AT_MOST, sound ? sparkly * 0.5 + clamp(sound.hat - 0.3, 0, 1) * 0.6 : sparkly)), GLITTER_SCALE);
  s._GlitterDensity = 0.15 + step.specks / 150;
  s._GlitterSize = 0.02 + clamp((step.speckSize - 1) / 8, 0, 1) * 0.05;
  colour("Sparkle", step.speckColour && chroma(step.speckColour) > 0.3 ? tinted(vivid(hueOfRgb(step.speckColour))) : accent);
  s._Twinkle = 1 + step.speckTurnover * 4;
  s._Shimmer = step.speckHues * 2;
  s._BeatSparkle = sound ? clamp(sound.hat, 0, 1) * 0.6 : (step.speckOnBeat - 1) * 2;
  s._Motes = sparkleAmount(Math.max(peak.motes * PEAK_AMOUNT, Math.min(SPARKLE_USUALLY_AT_MOST - 0.1, sound ? blobby * 0.5 + quiet * 0.5 : blobby)), MOTES_SCALE);
  s._MoteRise = 0.1 + step.blobRise * 2;
  return s;
}

const driven = (groups: readonly VideoLookGroup[]): PackParameter[] =>
  STAGE_PACK.parameters.filter(p => !LEFT_TO_THE_GAME.has(p.property) && groups.includes(p.group as VideoLookGroup));

/** The settings that say how much each colour shows. */
const COLOUR_AMOUNT: Record<string, string[]> = {
  "Tint colour": ["_TintAmount"], "Glow colour": ["_Glow"], "Vignette colour": ["_Vignette"], "Beat flash colour": ["_BeatFlash"], "Sparkle colour": ["_Glitter", "_Motes"],
};
/** Beats either side each setting is averaged over, within a shot; the noisiest more. Hues and flashes are left as they are. */
const SMOOTHING: Record<string, number> = {
  _KeyHue: 0, _BeatFlash: 0, _BeatFlashR: 0, _BeatFlashG: 0, _BeatFlashB: 0, _LightStrobeRate: 0,
  _KeyKeep: 2, _KeyStrictness: 2, _PulseSharpness: 2, _BeatSparkle: 2, _Shimmer: 2, _Twinkle: 2, _MoteRise: 2, _LightBeams: 2, _LightSweep: 2,
};
const SMOOTHING_OTHERWISE = 1;

/** Each step's settings averaged with its neighbours' - never across a cut, where the shot changes. */
export function smoothed(steps: Step[], settings: Record<string, number>[]): Record<string, number>[] {
  const shot: number[] = [];
  steps.forEach((step, k) => shot.push(k === 0 ? 0 : shot[k - 1] + (step.cut ? 1 : 0)));
  return settings.map((own, k) => {
    const out: Record<string, number> = {};
    for (const [property, value] of Object.entries(own)) {
      const reach = SMOOTHING[property] ?? SMOOTHING_OTHERWISE;
      let sum = 0, count = 0;
      for (let j = k - reach; j <= k + reach; j++) {
        const v = settings[j]?.[property];
        if (v === undefined || shot[j] !== shot[k]) continue;
        sum += v; count++;
      }
      out[property] = reach ? sum / count : value;
    }
    return out;
  });
}

/** The colour a setting belongs to, so its three channels are written together. */
const colourOf = (p: PackParameter) => p.colour ?? p.property;

/** What the song does at each step, if there is one. */
function soundsAt(steps: Step[], tempo: Tempo, song: SongRhythm | null): (SoundAt | null)[] {
  if (!song) return steps.map(() => null);
  const { rhythm, offset } = song, usual = Math.max(1e-6, usualLoudness(rhythm));
  const sounds = steps.map(step => {
    const at = step.start + offset;
    // The bar around the step: four beats with a tempo, two seconds without.
    const [from, to] = tempo.ok ? [tempo.seconds(Math.floor(tempo.beat(step.start) / 4) * 4), tempo.seconds(Math.floor(tempo.beat(step.start) / 4) * 4 + 4)] : [step.start - 1, step.start + 1];
    return { kick: hitAt(rhythm.kick, rhythm, at), snare: hitAt(rhythm.snare, rhythm, at), hat: hitAt(rhythm.hat, rhythm, at), loud: loudnessBetween(rhythm, from + offset, to + offset) / usual, rank: 0 };
  });
  const louder = sounds.map(s => s.loud).sort((a, b) => a - b);
  for (const s of sounds) s.rank = louder.length > 1 ? louder.findLastIndex(v => v <= s.loud) / (louder.length - 1) : 1;
  return sounds;
}

export function looksFromVideo(frames: FrameFeatures[], tempo: Tempo, options: VideoLookOptions, song: SongRhythm | null = null): LookCue[] {
  const quarter = snapToQuarterBeats(tempo);
  const snapCut = song ? (cut: number) => { const hit = hitNear(song.rhythm, cut + song.offset, CUT_FINDS_A_HIT_WITHIN); return hit == null ? quarter(cut) : hit - song.offset; } : quarter;
  const steps = stepsOf(frames, options.offset, tempo, snapCut), sounds = soundsAt(steps, tempo, song);
  if (!steps.length) return [];
  const base: Baseline = { specks: median(frames.map(f => f.specks)), blobs: median(frames.map(f => f.blobs)), motion: median(frames.map(f => f.motion)) };
  const peaks = peaksOf(steps, tempo, base, sounds);
  const keys = palettes(steps), parameters = driven(options.groups);
  const beatsASecond = tempo.ok ? 1 / Math.max(1e-3, tempo.seconds(1) - tempo.seconds(0)) : 0;
  const threshold = 0.02 + (1 - clamp(options.detail, 0, 1)) * 0.13, strength = clamp(options.strength, 0, 1);

  const wantedBySteps = smoothed(steps, steps.map((step, k) => settingsForStep(step, keys[k], base, beatsASecond, sounds[k], peaks[k]))).map(raw => {
    const wanted = new Map<string, number>();
    for (const p of parameters) {
      const value = raw[p.property];
      if (value === undefined) continue;
      // A hue isn't more or less of anything, so strength leaves it alone; how much the key is kept carries it.
      const scaled = p.property === "_KeyHue" ? value : p.default + (value - p.default) * strength;
      wanted.set(p.property, round(clamp(scaled, p.min, p.max), 3));
    }
    return wanted;
  });

  const cues: LookCue[] = [], written = new Map<string, number>();
  const now = (property: string) => written.get(property) ?? STAGE_PACK.parameters.find(p => p.property === property)!.default;
  let arrived = 0;
  steps.forEach((step, k) => {
    const wanted = wantedBySteps[k];
    const moved = new Set(parameters.filter(p => {
      if (!wanted.has(p.property)) return false;
      if (cues.length === 0) return true;
      // A colour's change counts as much as the colour shows: a tint colour hardly matters at no tint.
      const amount = p.colour && COLOUR_AMOUNT[p.colour] ? Math.max(...COLOUR_AMOUNT[p.colour].map(a => now(a) / (STAGE_PACK.parameters.find(q => q.property === a)!.max * 0.5))) : 1;
      const felt = FELT[p.property];
      if (felt) return Math.abs(felt(wanted.get(p.property)!) - felt(now(p.property))) > threshold;
      return Math.abs(wanted.get(p.property)! - now(p.property)) * clamp(amount, 0.2, 1) > threshold * (p.max - p.min);
    }).map(colourOf));
    if (!moved.size) return;
    // A cut shows at once; otherwise the look fades over one step, from the middle of the one before (or where the last
    // cue arrived, if that was later), to reach this step's at its middle - steps that changed nothing don't slow it.
    const middle = (step.start + step.end) / 2;
    const from = k > 0 ? Math.max(arrived, (steps[k - 1].start + steps[k - 1].end) / 2) : step.start;
    const time = step.cut || cues.length === 0 ? step.start : from;
    const fade = step.cut ? CUT_FADE_SECONDS : cues.length === 0 ? 0 : middle - from;
    const cue: LookCue = { t: round(time, 3), pack: STAGE_PACK.name };
    if (fade > 0) cue.fade = round(fade, 3);
    for (const p of parameters) {
      if (!wanted.has(p.property) || !moved.has(colourOf(p))) continue;
      setStageCueSetting(cue, findPackParameter(STAGE_PACK, p.property)!, wanted.get(p.property));
      written.set(p.property, wanted.get(p.property)!);
    }
    cues.push(cue);
    arrived = step.cut ? step.start + CUT_FADE_SECONDS : middle;
  });
  return cues;
}
