// The look preview: a small painted arena run through BossBattles Stage's whole fragment shader, pixel
// by pixel - the grade, fog by depth, the key's glow, the beat, Magic's sparkles in the air, the vignette and the
// danger edges. The
// arena stands in for the game's: sky, far hills, pillars going back into the fog, the lane, the boss,
// and projectiles in the key colour (whatever the key hue is) beside one that is not.
import { hueToRgb, keyness, linearToSrgb, mix, stageColour, toKeySpace, type Rgb, type StageLook, type StageSettings } from "./looks";

/** A painted arena: linear colours and each pixel's depth in metres (Infinity for the sky). */
export type StageScene = { width: number; height: number; colour: Float32Array; depth: Float32Array };

/**
 * The fight, as the mod tells the shader: where in the beat (null without a bpm), health 0 to 1, a hit fading 1 to 0,
 * and the time in seconds, which Magic's sparkles twinkle and drift by.
 */
export type StageFight = { beatFraction: number | null; health: number; hit: number; time?: number };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// The game's frame is about this many pixels across, so the glow's taps reach as far across the preview as they do there.
const GAME_WIDTH_PIXELS = 1920;
const EYE_HEIGHT_METRES = 1.6;
const HORIZON = 0.44;

const SKY_TOP: Rgb = [0.16, 0.3, 0.62], SKY_HORIZON: Rgb = [0.55, 0.66, 0.8];
const HILLS: Rgb = [0.15, 0.2, 0.25], HILLS_METRES = 140;
const GRASS: Rgb = [0.1, 0.19, 0.06], DIRT: Rgb = [0.26, 0.2, 0.13], LANE: Rgb = [0.36, 0.29, 0.19], ARENA_METRES = 16;
const STONE: Rgb = [0.21, 0.2, 0.18], STONE_LIT: Rgb = [0.3, 0.28, 0.25];
const BOSS: Rgb = [0.07, 0.07, 0.09];

type Hit = { colour: Rgb; depth: number };
type Box = { x: number; z: number; width: number; height: number };
type Ball = { x: number; y: number; z: number; radius: number; key: boolean };

const PILLARS: Box[] = [
  { x: -4.2, z: 7, width: 0.9, height: 3 }, { x: 5, z: 12, width: 1.1, height: 4.2 }, { x: -9, z: 21, width: 1.4, height: 5.5 },
  { x: 12, z: 30, width: 1.8, height: 7 }, { x: -2.5, z: 45, width: 2, height: 8 },
];
const BALLS: Ball[] = [
  { x: -0.7, y: 1.5, z: 3.2, radius: 0.22, key: true }, { x: 1.1, y: 1.2, z: 6.5, radius: 0.28, key: true },
  { x: 0.5, y: 2.6, z: 10.5, radius: 0.35, key: true }, { x: 2.4, y: 1.4, z: 5, radius: 0.26, key: false },
];
const BOSS_AT = { x: 0, z: 11, width: 1.3, height: 2.6 };

// The painted arena's camera: at eye height looking along +z, a pixel's direction from its distance to the centre and horizon.
const sceneCamera = (width: number, height: number) => ({ focal: height * 0.95, horizonY: height * HORIZON, centreX: width / 2 });

/** Paints the arena, with things in the key colour painted in the key hue. Two by two samples a pixel. */
export function paintStageScene(width: number, height: number, keyHueDegrees: number): StageScene {
  const colour = new Float32Array(width * height * 3), depth = new Float32Array(width * height);
  const key = hueToRgb(keyHueDegrees, 0.9, 0.75), other = hueToRgb((keyHueDegrees + 200) % 360, 0.75, 0.6);
  const { focal, horizonY, centreX } = sceneCamera(width, height);

  const sample = (sx: number, sy: number): Hit => {
    // The nearest thing a ray through this point meets: balls, then the boss and pillars, then the ground or sky.
    let best: Hit | null = null;
    const consider = (hit: Hit | null) => { if (hit && (!best || hit.depth < best.depth)) best = hit; };
    for (const b of BALLS) {
      const bx = centreX + b.x * focal / b.z, by = horizonY - (b.y - EYE_HEIGHT_METRES) * focal / b.z, r = b.radius * focal / b.z;
      const d = Math.hypot(sx - bx, sy - by) / r;
      if (d <= 1) {
        const base = b.key ? key : other, light = 0.75 + 0.35 * clamp01(1 - Math.hypot(sx - (bx - r * 0.35), sy - (by - r * 0.35)) / r);
        consider({ colour: base.map(v => v * light) as Rgb, depth: b.z - b.radius * Math.sqrt(1 - d * d) });
      }
    }
    {
      const b = BOSS_AT, x0 = centreX + (b.x - b.width / 2) * focal / b.z, x1 = centreX + (b.x + b.width / 2) * focal / b.z;
      const top = horizonY - (b.height - EYE_HEIGHT_METRES) * focal / b.z, bottom = horizonY + EYE_HEIGHT_METRES * focal / b.z;
      const u = (sx - x0) / (x1 - x0), v = (sy - top) / (bottom - top);
      // A hooded figure: narrow at the head, widening to the shoulders, with eyes in the key colour.
      const halfWidth = v < 0.22 ? 0.28 : v < 0.32 ? 0.28 + (v - 0.22) * 2.2 : 0.5;
      if (v >= 0 && v <= 1 && Math.abs(u - 0.5) <= halfWidth) {
        const eye = v > 0.1 && v < 0.15 && (Math.abs(u - 0.4) < 0.06 || Math.abs(u - 0.6) < 0.06);
        const core = Math.hypot((u - 0.5) * 1.6, v - 0.45) < 0.07;
        consider({ colour: eye || core ? key : BOSS, depth: b.z });
      }
    }
    for (const p of PILLARS) {
      const x0 = centreX + (p.x - p.width / 2) * focal / p.z, x1 = centreX + (p.x + p.width / 2) * focal / p.z;
      const top = horizonY - (p.height - EYE_HEIGHT_METRES) * focal / p.z, bottom = horizonY + EYE_HEIGHT_METRES * focal / p.z;
      if (sx >= x0 && sx <= x1 && sy >= top && sy <= bottom) {
        const lit = (sx - x0) / (x1 - x0) < 0.35;
        // A banner on the second pillar, in a colour that is not the key.
        const banner = p === PILLARS[1] && (sy - top) / (bottom - top) > 0.12 && (sy - top) / (bottom - top) < 0.5 && !lit;
        consider({ colour: banner ? other : lit ? STONE_LIT : STONE, depth: p.z });
      }
    }
    if (best) return best;

    if (sy > horizonY) {
      const z = EYE_HEIGHT_METRES * focal / (sy - horizonY), x = (sx - centreX) * z / focal;
      const onLane = Math.abs(x) < 1.3 && z < 26, inArena = Math.hypot(x, z - 8) < ARENA_METRES;
      const stripe = onLane && Math.abs(x) > 1.15 ? 1.25 : 1;
      return { colour: onLane ? LANE.map(v => v * stripe) as Rgb : inArena ? DIRT : GRASS, depth: z };
    }
    const hill = horizonY - height * (0.05 + 0.03 * Math.sin(sx / width * 9 + 1) + 0.02 * Math.sin(sx / width * 23));
    if (sy > hill) return { colour: HILLS, depth: HILLS_METRES };
    return { colour: mix(SKY_TOP, SKY_HORIZON, clamp01(sy / horizonY) ** 2), depth: Infinity };
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sum: Rgb = [0, 0, 0];
      let nearest = Infinity;
      for (const [ox, oy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        const hit = sample(x + ox, y + oy);
        sum[0] += hit.colour[0] / 4; sum[1] += hit.colour[1] / 4; sum[2] += hit.colour[2] / 4;
        nearest = Math.min(nearest, hit.depth);
      }
      const i = y * width + x;
      colour.set(sum, i * 3);
      depth[i] = nearest;
    }
  }
  return { width, height, colour, depth };
}

/**
 * The Stage shader's Frag for every pixel of the scene, into RGBA bytes. Off, the pack does nothing:
 * the scene as it is. `running` is 1 throughout - the editor is always mid-battle. Given rows, it shades
 * only rows `firstRow` up to (not including) `endRow`, into `out` from its start: a band, for one of several workers.
 */
export function shadeStageFrame(scene: StageScene, look: StageLook, fight: StageFight, out: Uint8ClampedArray, firstRow = 0, endRow = scene.height): void {
  const { width, height, colour, depth } = scene, s = look.settings, base = firstRow * width;
  if (!look.on) {
    for (let i = base; i < endRow * width; i++) writePixel(out, i - base, colour[i * 3], colour[i * 3 + 1], colour[i * 3 + 2]);
    return;
  }

  const maps = keyMaps(scene, s._KeyHue, s._KeyStrictness), keynessOf = maps.keyness;

  const tint = mix([1, 1, 1], stageColour(s, "Tint"), s._TintAmount), fogColour = stageColour(s, "Fog"), glowColour = stageColour(s, "Glow");
  const flashColour = stageColour(s, "BeatFlash"), vignetteColour = stageColour(s, "Vignette"), dangerColour = stageColour(s, "Danger");
  const beat = fight.beatFraction == null ? 0 : Math.exp(-fight.beatFraction * s._PulseSharpness);
  const pulse = beat * s._BeatPulse;
  const danger = clamp01(fight.hit * s._HitFlash * 1.5 + clamp01(1 - fight.health) * s._LowHealth);
  const glowing = s._Glow > 0.001 && s._GlowRadius > 0.001, blurred = glowing ? blurredGlow(scene, maps, s._GlowRadius) : null;
  const darkening = 1 - 0.75 * s._Darkness, kept = 1 + 0.3 * s._Glow, fogging = s._FogDensity > 0.0001;
  const glowScale = s._KeyKeep / 12 * s._Glow * (1 + 2 * pulse), flash = beat * s._BeatFlash;
  const magicShows = s._Glitter > 0.001 || s._Motes > 0.001, magic: Rgb = [0, 0, 0];
  const rays = magicShows ? viewRays(scene) : null, time = fight.time ?? 0;

  // Plain numbers rather than [r, g, b] arrays: this runs for every pixel, every frame while playing.
  const pixel = [0, 0, 0];
  for (let y = firstRow; y < endRow; y++) {
    const v = (y + 0.5) / height - 0.5;
    for (let x = 0; x < width; x++) {
      const i = y * width + x, k = keynessOf[i] * s._KeyKeep, r = colour[i * 3], g = colour[i * 3 + 1], b = colour[i * 3 + 2];
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const fog = !fogging ? 0 : (depth[i] === Infinity ? s._SkyFog : 1 - Math.exp(-s._FogDensity * Math.max(0, depth[i] - s._FogStart))) * (1 - s._FogKeyResist * k);

      const glow = blurred ? blurred[i] * glowScale : 0;

      if (rays) magicAt(i, rays, s, beat, time, magic);

      const u = (x + 0.5) / width - 0.5, edge = clamp01((u * u + v * v) * s._VignetteSize);
      const vignette = edge * s._Vignette, hurt = edge * danger;
      for (let ch = 0; ch < 3; ch++) {
        const scene = ch === 0 ? r : ch === 1 ? g : b;
        const drained = (luma + (scene - luma) * s._Saturation) * darkening * tint[ch];
        let c = Math.max(0, (drained + (scene * kept - drained) * k - 0.18) * s._Contrast + 0.18);
        c += (fogColour[ch] - c) * fog;
        c += glowColour[ch] * glow + flashColour[ch] * flash;
        if (magicShows) c += magic[ch];
        c += (vignetteColour[ch] - c) * vignette;
        pixel[ch] = c + (dangerColour[ch] - c) * hurt;
      }
      writePixel(out, i - base, pixel[0], pixel[1], pixel[2]);
    }
  }
}

// ---- Magic: the shader's glitter and motes, from the painted arena's own camera and depths ---------------------

// This runs up to 40 times a pixel, every frame, so it makes no strings or arrays as it goes: the hashes go
// into scratch arrays, and each pixel's view ray is worked out once per scene.

const fract = (v: number) => v - Math.floor(v);

// The shader's Hash3: three numbers from 0 to 1 for a cell of the world, into `out`.
function hash3(x: number, y: number, z: number, out: Float64Array): void {
  let a = fract(x * 0.1031), b = fract(y * 0.103), c = fract(z * 0.0973);
  const d = a * (b + 33.33) + b * (a + 33.33) + c * (c + 33.33);
  a += d; b += d; c += d;
  out[0] = fract((a + b) * c); out[1] = fract(2 * a * b); out[2] = fract((a + b) * a);
}
const random = new Float64Array(3), offset = new Float64Array(3);

const sparkleChannel = (hue: number, shift: number, colour: number, s: StageSettings) =>
  colour + (clamp01(Math.abs(fract(hue + shift) * 6 - 3) - 1) - colour) * s._Shimmer;

function addSparkle(out: Rgb, hue: number, amount: number, s: StageSettings): void {
  out[0] += sparkleChannel(hue, 0, s._SparkleR, s) * amount;
  out[1] += sparkleChannel(hue, 2 / 3, s._SparkleG, s) * amount;
  out[2] += sparkleChannel(hue, 1 / 3, s._SparkleB, s) * amount;
}

function twinkle(pace: number, phase: number, beat: number, time: number, s: StageSettings): number {
  // To the 12th power, by squaring: ** is slow here.
  const v = 0.5 + 0.5 * Math.sin(time * s._Twinkle * 6.2831853 * (0.6 + 0.8 * pace) + phase * 40), v2 = v * v, v4 = v2 * v2;
  return v4 * v4 * v4 * (1 + 4 * beat * s._BeatSparkle);
}

// The shader's AirSparkles: sparkles along the view ray (ox, oy, oz) from the eye, up to the scene, into `out`.
function airSparkles(out: Rgb, ox: number, oy: number, oz: number, sceneDistance: number, s: StageSettings, beat: number, time: number,
  cellSize: number, stepLength: number, steps: number, density: number, radius: number, drift: number, sway: number, steady: number, seed: number,
  amount: number): void {
  const firstAt = cellSize * 0.3;
  let lastX = NaN, lastY = NaN, lastZ = NaN;
  for (let i = 0; i < steps; i++) {
    const along = firstAt + i * stepLength;
    if (along > sceneDistance) break;
    const cx = Math.floor(ox * along / cellSize), cy = Math.floor((EYE_HEIGHT_METRES + oy * along - drift) / cellSize), cz = Math.floor(oz * along / cellSize);
    if (cx === lastX && cy === lastY && cz === lastZ) continue;
    lastX = cx; lastY = cy; lastZ = cz;

    hash3(cx + seed, cy + seed, cz + seed, random);
    if (random[0] > density) continue;
    hash3(cx + seed + 3.3, cy + seed + 3.3, cz + seed + 3.3, offset);
    const mx = (cx + 0.2 + 0.6 * offset[0]) * cellSize + sway * Math.sin(time * 0.7 + random[1] * 6.2831853);
    const my = (cy + 0.2 + 0.6 * offset[1]) * cellSize + drift;
    const mz = (cz + 0.2 + 0.6 * offset[2]) * cellSize + sway * Math.sin(time * 0.7 + random[2] * 6.2831853);

    const distance = ox * mx + oy * (my - EYE_HEIGHT_METRES) + oz * mz;
    if (distance < firstAt || distance > sceneDistance) continue;
    const ex = ox * distance - mx, ey = EYE_HEIGHT_METRES + oy * distance - my, ez = oz * distance - mz;
    const spread2 = (ex * ex + ey * ey + ez * ez) / (radius * radius + 0.0002 * distance);
    if (spread2 > 9) continue;
    const nearFade = clamp01((distance - firstAt) / firstAt);
    addSparkle(out, random[2], Math.exp(-spread2) * nearFade * (steady + (1 - steady) * twinkle(random[1], random[2], beat, time, s)) * amount, s);
  }
}

// Weakly, by scene, like the key maps: each pixel's view ray from the eye (x, y, z) and how far along it the scene is.
const raysByScene = new WeakMap<StageScene, Float64Array>();

function viewRays(scene: StageScene): Float64Array {
  const kept = raysByScene.get(scene);
  if (kept) return kept;
  const { width, height, depth } = scene, camera = sceneCamera(width, height), rays = new Float64Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x, dx = (x + 0.5 - camera.centreX) / camera.focal, dy = -(y + 0.5 - camera.horizonY) / camera.focal, length = Math.hypot(dx, dy, 1);
      rays[i * 4] = dx / length; rays[i * 4 + 1] = dy / length; rays[i * 4 + 2] = 1 / length;
      rays[i * 4 + 3] = depth[i] === Infinity ? 1000 : depth[i] * length;
    }
  }
  raysByScene.set(scene, rays);
  return rays;
}

// Glitter and motes for pixel i, into `out`: what the shader adds after the beat flash.
function magicAt(i: number, rays: Float64Array, s: StageSettings, beat: number, time: number, out: Rgb): void {
  out[0] = out[1] = out[2] = 0;
  const ox = rays[i * 4], oy = rays[i * 4 + 1], oz = rays[i * 4 + 2], sceneDistance = rays[i * 4 + 3];

  if (s._Glitter > 0.001)
    airSparkles(out, ox, oy, oz, sceneDistance, s, beat, time, 0.5, 0.2, 24, s._GlitterDensity, s._GlitterSize * 0.25, -time * 0.08, 0.05, 0, 17.3, s._Glitter);
  if (s._Motes > 0.001)
    airSparkles(out, ox, oy, oz, sceneDistance, s, beat, time, 1.2, 0.5, 16, 0.5, 0.0173, time * s._MoteRise, 0.15, 0.25, 91.7, s._Motes);

  const throughFog = Math.exp(-s._FogDensity * 0.5 * Math.min(sceneDistance, 60));
  out[0] *= throughFog; out[1] *= throughFog; out[2] *= throughFog;
}

type KeyMaps = { hue: number; strictness: number; keyness: Float32Array; glowSource: Float32Array; blurred?: { radius: number; glow: Float32Array } };
// Weakly, by scene: once the preview closes and lets go of its scene, these go with it.
const keyMapsByScene = new WeakMap<StageScene, KeyMaps>();

// How much each pixel is the key, and what it gives the glow's taps (its keyness times its key-space red) -
// kept between frames while the key hue and strictness stay put, as they do while playing.
function keyMaps(scene: StageScene, hue: number, strictness: number): KeyMaps {
  const kept = keyMapsByScene.get(scene);
  if (kept && kept.hue === hue && kept.strictness === strictness) return kept;
  const count = scene.width * scene.height, keynessMap = new Float32Array(count), glowSource = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const keyed = toKeySpace([scene.colour[i * 3], scene.colour[i * 3 + 1], scene.colour[i * 3 + 2]], hue);
    keynessMap[i] = keyness(keyed, strictness);
    glowSource[i] = keynessMap[i] * keyed[0];
  }
  const maps = { hue, strictness, keyness: keynessMap, glowSource };
  keyMapsByScene.set(scene, maps);
  return maps;
}

// The glow's ring of taps over the key, summed for every pixel: kept with the key maps while the radius stays put,
// so a frame only scales it by the glow, the key kept and the beat.
function blurredGlow(scene: StageScene, maps: KeyMaps, radius: number): Float32Array {
  if (maps.blurred?.radius === radius) return maps.blurred.glow;
  const { width, height } = scene, reach = radius * 4 * width / GAME_WIDTH_PIXELS, glow = new Float32Array(width * height);
  const ringX = Array.from({ length: 8 }, (_, i) => Math.cos(i * 0.785398) * reach), ringY = Array.from({ length: 8 }, (_, i) => Math.sin(i * 0.785398) * reach);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let tap = 0; tap < 8; tap++) {
        sum += bilinear(maps.glowSource, width, height, x + ringX[tap], y + ringY[tap])
          + 0.5 * bilinear(maps.glowSource, width, height, x + ringX[tap] * 2.2, y + ringY[tap] * 2.2);
      }
      glow[y * width + x] = sum;
    }
  }
  maps.blurred = { radius, glow };
  return glow;
}

// The texture sampler's linear filtering, clamped at the edges.
function bilinear(map: Float32Array, width: number, height: number, x: number, y: number): number {
  const fx = Math.min(width - 1, Math.max(0, x)), fy = Math.min(height - 1, Math.max(0, y));
  const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(width - 1, x0 + 1), y1 = Math.min(height - 1, y0 + 1), ax = fx - x0, ay = fy - y0;
  const top = map[y0 * width + x0] * (1 - ax) + map[y0 * width + x1] * ax, bottom = map[y1 * width + x0] * (1 - ax) + map[y1 * width + x1] * ax;
  return top * (1 - ay) + bottom * ay;
}

// Linear to sRGB bytes by table rather than three powers a pixel; within a byte of the exact curve.
const SRGB_STEPS = 8192;
const SRGB_BYTES = Float32Array.from({ length: SRGB_STEPS + 1 }, (_, i) => linearToSrgb(i / SRGB_STEPS) * 255);
const srgbByte = (v: number) => SRGB_BYTES[v <= 0 ? 0 : v >= 1 ? SRGB_STEPS : Math.round(v * SRGB_STEPS)];

function writePixel(out: Uint8ClampedArray, i: number, r: number, g: number, b: number): void {
  out[i * 4] = srgbByte(r);
  out[i * 4 + 1] = srgbByte(g);
  out[i * 4 + 2] = srgbByte(b);
  out[i * 4 + 3] = 255;
}

/**
 * What a frame depends on, as text: two moments with the same key shade the same, so the preview can
 * skip the second. The beat and the fight only count when the look's settings use them.
 */
export function stageFrameKey(look: StageLook, fight: StageFight): string {
  if (!look.on) return "off";
  const s = look.settings;
  const beatShows = s._BeatFlash > 0 || (s._BeatPulse > 0 && s._Glow > 0.001 && s._GlowRadius > 0.001);
  const beat = beatShows && fight.beatFraction != null ? Math.exp(-fight.beatFraction * s._PulseSharpness) : 0;
  const danger = clamp01(fight.hit * s._HitFlash * 1.5 + clamp01(1 - fight.health) * s._LowHealth);
  const magicMoves = s._Glitter > 0.001 || s._Motes > 0.001;
  return `${Object.values(s).join(",")}|${beat}|${danger}|${magicMoves ? fight.time ?? 0 : ""}`;
}
