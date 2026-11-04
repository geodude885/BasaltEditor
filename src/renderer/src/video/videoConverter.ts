// The music video converter: BossBattles Stage looks from a music video's frames and, when the chart has one, its
// song. The rules are in looks.ts; this is how the editor offers them. MAKES and LEAVES between them name every
// setting of the pack - a test checks that MAKES is exactly what the rules write - so the editor can say what it
// will touch and what it won't.
import { STAGE_PACK } from "../model/looks";
import type { LookConverter } from "./converters";
import { DEFAULT_VIDEO_LOOK_OPTIONS, looksFromVideo, VIDEO_LOOK_GROUPS, type VideoLookGroup } from "./looks";

/** The settings the rules make, and from what. A colour's three channels share one. */
export const MAKES: Record<string, string> = {
  _KeyHue: "The video's strongest hue, held until another is clearly stronger",
  _KeyStrictness: "Kept at 2.5",
  _KeyKeep: "How much of the frame's colour that hue is",
  _Saturation: "How saturated the video is, lifted in loud bars",
  _Darkness: "How dark the video is; darker still for a quiet bar or a light show",
  _Contrast: "The video's contrast",
  _TintAmount: "How much of the frame's colour the key hue is, less in a light show",
  _TintR: "The key hue, made vivid", _TintG: "The key hue, made vivid", _TintB: "The key hue, made vivid",
  _Glow: "How much of the frame is bright, more in loud bars",
  _GlowRadius: "How soft the bright parts are",
  _GlowR: "The second hue, made vivid", _GlowG: "The second hue, made vivid", _GlowB: "The second hue, made vivid",
  _FogDensity: "How bright and hazy the frame is; thicker for a white blast",
  _FogStart: "Whether the haze is only far away, at the top of the frame",
  _SkyFog: "How flat the top of the frame is",
  _FogR: "The key hue, whiter as the video loses colour", _FogG: "The key hue, whiter as the video loses colour", _FogB: "The key hue, whiter as the video loses colour",
  _BeatPulse: "The song's kick and how loud the bar is, or the video's motion; more when the video strobes",
  _PulseSharpness: "How hard the kick hits, and how hard the video strobes",
  _BeatFlash: "Flashes and cuts in the video, and hard snares in loud bars",
  _BeatFlashR: "The flash's own hue, or the second hue", _BeatFlashG: "The flash's own hue, or the second hue", _BeatFlashB: "The flash's own hue, or the second hue",
  _Vignette: "How much darker the video's edges are",
  _VignetteR: "The shadows' hue, or the key's", _VignetteG: "The shadows' hue, or the key's", _VignetteB: "The shadows' hue, or the key's",
  _Glitter: "Specks in the video above its usual and the song's hi-hats; high in its sparkliest bars",
  _GlitterDensity: "How many specks there are",
  _GlitterSize: "How big the specks are",
  _Motes: "Soft blobs in the video above its usual and the song's quiet parts; high in its softest bars",
  _MoteRise: "How fast the blobs drift up",
  _Twinkle: "How often specks come and go",
  _BeatSparkle: "The song's hi-hats, or specks flaring on the beat",
  _Shimmer: "How many hues the specks have",
  _SparkleR: "The specks' own hue, or the second hue", _SparkleG: "The specks' own hue, or the second hue", _SparkleB: "The specks' own hue, or the second hue",
  _Lights: "The song's loudest bars, or where the video moves most; high in a light show",
  _LightBeams: "How much is going on",
  _LightSweep: "The tempo, and how much is going on",
  _LightWidth: "Wide in quiet bars, thin as lasers in a light show",
  _LightStrobe: "Strong kicks in lit bars, and a light show's strobing",
  _LightStrobeRate: "How fast the video's own strobe flashes",
  _LightChase: "How much the lit bar builds",
  _LightR: "The second hue, made vivid", _LightG: "The second hue, made vivid", _LightB: "The second hue, made vivid",
};

/** The settings it leaves alone, and why. */
export const LEAVES: Record<string, string> = {
  _Kaleidoscope: "Left off: the soft glow does the glowing",
  _KaleidoscopeRadius: "Left off, with Kaleidoscope",
  _FogKeyResist: "Left as it is: how the key shows through fog is a matter of taste",
  _VignetteSize: "Left as it is",
  _HitFlash: "The game's: it flashes the edges when you are hit",
  _LowHealth: "The game's: it closes in as your health drops",
  _DangerR: "The game's", _DangerG: "The game's", _DangerB: "The game's",
};

export const videoConverter: LookConverter = {
  id: "music-video",
  name: "Music video",
  description: "Looks that follow a music video: its colours, brightness, cuts, sparkle and light shows, and the chart's song's drums and loudness when it has one. "
    + "A cue on each beat (or two, for a fast song) where something changes.",
  usesSong: true,
  options: [
    { id: "strength", kind: "number", label: "Strength", help: "0 keeps the pack's defaults; 1 follows the video fully", min: 0, max: 1, step: 0.05, default: DEFAULT_VIDEO_LOOK_OPTIONS.strength },
    { id: "detail", kind: "number", label: "Detail", help: "How small a change still makes a cue: more detail, more cues", min: 0, max: 1, step: 0.05, default: DEFAULT_VIDEO_LOOK_OPTIONS.detail },
    { id: "groups", kind: "choices", label: "Makes", help: "Which of the pack's groups it sets; the others are left as they are", choices: VIDEO_LOOK_GROUPS, default: VIDEO_LOOK_GROUPS },
  ],
  coverage: STAGE_PACK.parameters.map(p => ({ property: p.property, made: p.property in MAKES, how: MAKES[p.property] ?? LEAVES[p.property] ?? "Left as it is" })),
  generate: ({ frames, song, tempo, videoStart }, options) => looksFromVideo(frames, tempo, {
    offset: videoStart,
    strength: +(options.strength ?? DEFAULT_VIDEO_LOOK_OPTIONS.strength),
    detail: +(options.detail ?? DEFAULT_VIDEO_LOOK_OPTIONS.detail),
    groups: (options.groups as readonly VideoLookGroup[] | undefined) ?? VIDEO_LOOK_GROUPS,
  }, song),
};
