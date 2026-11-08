// A chart's files: chart.json beside its song, cover and clips/*.json - opened loose, from a folder,
// or from a package (.bbchart, or .zip as the hosted editor saved them).
import { mp3InsideWav } from "../audio/riff";
import * as Jsonc from "../model/jsonc";
import { clipsPlayed } from "../model/performances";
import type { Chart } from "../model/types";
import { readZip } from "./zip";

export type FileEntry = { path: string; bytes: Uint8Array };

/**
 * What was opened: a chart (unless only extra files came), and the other files by path relative to it -
 * and, from a package of several difficulties, the others, each the same way.
 */
export type Opened = { chart?: { text: string; name: string }; files: Map<string, Uint8Array>; others?: Opened[] };

export const isPackage = (path: string): boolean => /\.(bbchart|zip)$/i.test(path);

/** Sorts opened files into the chart and the files beside it. */
export async function readEntries(entries: FileEntry[]): Promise<Opened> {
  const pack = entries.find(e => isPackage(e.path));
  if (pack) {
    const [first, ...others] = unpackAll(await readZip(pack.bytes), pack.path.split(/[\\/]/).pop()!);
    return others.length ? { ...first, others } : first;
  }
  const chart = entries.find(e => /(^|\/)chart\.json$/i.test(e.path))
    ?? entries.find(e => /\.json$/i.test(e.path) && !/clips\//i.test(e.path) && !/-(take|clip)-\d+\.json$/i.test(e.path));
  const files = new Map<string, Uint8Array>();
  for (const e of entries) if (e !== chart) files.set(relative(e.path, chart?.path), e.bytes);
  return { chart: chart && { text: new TextDecoder().decode(chart.bytes), name: chart.path.split("/").pop()! }, files };
}

/** A package's chart and files: the first of its difficulties, when it holds several. */
export function unpack(files: Map<string, Uint8Array>, name: string): Opened {
  return unpackAll(files, name)[0];
}

/**
 * Every chart in a package, with its own files. chart.json may sit at the top (one chart), or in folders
 * at the top level, one chart each - the several difficulties of one song, which the game lists together
 * as it does any charts of the same name.
 */
export function unpackAll(files: Map<string, Uint8Array>, name: string): Opened[] {
  const prefixes = files.has("chart.json") ? [""] : [...files.keys()].filter(k => /^[^/]+\/chart\.json$/.test(k)).sort().map(k => k.slice(0, k.indexOf("/") + 1));
  if (!prefixes.length) throw new Error("it has no chart.json");
  const charts = prefixes.map(prefix => {
    const rest = new Map<string, Uint8Array>();
    for (const [k, v] of files) if (k !== prefix + "chart.json" && k.startsWith(prefix)) rest.set(k.slice(prefix.length), v);
    return { chart: { text: new TextDecoder().decode(files.get(prefix + "chart.json")), name }, files: rest };
  });
  // In the game's order, so the hardest opens first as the game lists it first.
  const rank = (o: Opened) => { try { return difficultyRank((Jsonc.parse(o.chart!.text) as Partial<Chart>).difficulty); } catch { return Infinity; } };
  return charts.sort((a, b) => rank(a) - rank(b));
}

/** A file's path relative to the chart's folder, so "clips/x.json" stays "clips/x.json" and a loose clip goes into clips/. */
export function relative(path: string, chartPath?: string): string {
  const parts = path.split("/"), base = chartPath ? chartPath.split("/").slice(0, -1) : [];
  let i = 0;
  while (i < base.length && parts[i] === base[i]) i++;
  const rel = parts.slice(i).join("/");
  if (/clips\//i.test(rel) || !/\.json$/i.test(rel)) return rel;
  return /-take-\d+\.json$|clip/i.test(rel) ? `clips/${parts[parts.length - 1]}` : rel;
}

const sameName = (key: string, name: string) =>
  key.toLowerCase() === name.toLowerCase() || key.split("/").pop()!.toLowerCase() === name.toLowerCase();

export const isSong = (path: string): boolean => /\.(ogg|mp3)$/i.test(path);
export const isCover = (path: string): boolean => /\.(png|jpe?g)$/i.test(path);

/**
 * A song's media type, for the player. Without one, a browser guesses from the first bytes - and
 * Safari doesn't recognise an MP3 that starts straight with audio rather than an ID3 tag.
 */
export function songType(path: string): string {
  const ext = path.toLowerCase().split(".").pop();
  return ext === "ogg" ? "audio/ogg" : ext === "wav" ? "audio/wav" : "audio/mpeg";
}

/** The song the chart names - or any song, if it names none yet. */
export const findSong = (files: Map<string, Uint8Array>, named?: string): string | undefined =>
  [...files.keys()].find(k => named ? sameName(k, named) : isSong(k));

/** The cover the chart names - or any image, if it names none yet. */
export const findCover = (files: Map<string, Uint8Array>, named?: string): string | undefined =>
  [...files.keys()].find(k => named ? k.toLowerCase() === named.toLowerCase() : isCover(k));

export type ClipSpan = { start: number; end: number };

/** Recorded clips among the files, by name, with when their frames start and end - for drawing them on their performances' rows. */
export function clipSpans(files: Map<string, Uint8Array>): Map<string, ClipSpan> {
  const out = new Map<string, ClipSpan>();
  for (const [k, v] of files) {
    const clip = readClip(k, v);
    if (clip) out.set(clip.name, clip.span);
  }
  return out;
}

/** A recorded clip's name (its own, else its file's) and span, or undefined for a file that isn't one. */
function readClip(path: string, bytes: Uint8Array): { name: string; span: ClipSpan } | undefined {
  if (!/\.json$/i.test(path)) return undefined;
  try {
    const clip = JSON.parse(new TextDecoder().decode(bytes)), frames = clip.Frames ?? clip.frames;
    if (!Array.isArray(frames) || !frames.length) return undefined;
    const first = frames[0], last = frames[frames.length - 1];
    return { name: clip.Name ?? clip.name ?? path.split("/").pop()!.replace(/\.json$/i, ""), span: { start: first.T ?? first.t ?? 0, end: last.T ?? last.t ?? 0 } };
  } catch { return undefined; }
}

/** Whether a file in clips/ goes in a package: a recording a performance plays, or anything that isn't a recording. */
const clipNeeded = (path: string, bytes: Uint8Array, played: ReadonlySet<string>): boolean => {
  const clip = readClip(path, bytes);
  return !clip || played.has(clip.name);
};

/** A package's file name for a chart. */
export const packageName = (chartName: string | undefined): string => `${(chartName || "chart").replace(/[^\w-]+/g, "-")}.bbchart`;

/**
 * What a package holds: chart.json, the chart's own song and cover, and the recorded clips its performances
 * play - not backups, other songs, clips no longer played or anything else opened beside them. A song that is MP3 audio in a WAV wrapper
 * goes in as the plain MP3 inside, which the game can read, and the packaged chart.json names that.
 */
export function packageContents(text: string, chart: Pick<Chart, "music" | "cover" | "performances">, files: Map<string, Uint8Array>): { entries: FileEntry[]; unwrapped?: string } {
  const entries: FileEntry[] = [];
  let chartText = text, unwrapped: string | undefined;
  const { song, cover } = namedFiles(chart, files);
  if (song) {
    const bytes = files.get(song)!, inside = mp3InsideWav(bytes);
    if (inside) {
      unwrapped = song.replace(/\.[^./]*$/, "") + ".mp3";
      entries.push({ path: unwrapped, bytes: inside });
      chartText = Jsonc.set(chartText, "music", { ...chart.music, file: unwrapped });
    } else entries.push({ path: song, bytes });
  }
  if (cover) entries.push({ path: cover, bytes: files.get(cover)! });
  const played = clipsPlayed(chart);
  for (const [path, bytes] of files) if (/^clips\//i.test(path) && clipNeeded(path, bytes, played)) entries.push({ path, bytes });
  return { entries: [{ path: "chart.json", bytes: new TextEncoder().encode(chartText) }, ...entries], unwrapped };
}

/** A chart to package with others: its text, as parsed, and the files beside it. */
export type PackagedChart = { text: string; chart: Pick<Chart, "music" | "cover" | "difficulty" | "performances">; files: Map<string, Uint8Array> };

/** The game's own order for difficulties (its ChartLibrary): these first, then any others by name, then a chart with none. */
const DIFFICULTY_ORDER = ["expert", "hard", "normal", "easy"];
const difficultyRank = (difficulty?: string): number => {
  if (!difficulty?.trim()) return Infinity;
  const known = DIFFICULTY_ORDER.indexOf(difficulty.trim().toLowerCase());
  return known >= 0 ? known : DIFFICULTY_ORDER.length;
};

/** A difficulty's folder in a package: its name, lower case, letters and digits - "chart" with none - and never two alike. */
function difficultyFolder(difficulty: string | undefined, taken: Set<string>): string {
  const base = (difficulty ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "chart";
  let folder = base;
  for (let n = 2; taken.has(folder); n++) folder = `${base}-${n}`;
  taken.add(folder);
  return folder;
}

/**
 * A package of one song's difficulties: with one chart, as packageContents makes it; with several, each in a
 * folder of its own named after its difficulty (easy/, hard/...), with its own song, cover and clips, in the
 * game's order. Says which songs went in as the MP3 inside a WAV.
 */
export function packageDifficulties(charts: PackagedChart[]): { entries: FileEntry[]; unwrapped: string[] } {
  if (charts.length === 1) {
    const { entries, unwrapped } = packageContents(charts[0].text, charts[0].chart, charts[0].files);
    return { entries, unwrapped: unwrapped ? [unwrapped] : [] };
  }
  const taken = new Set<string>(), entries: FileEntry[] = [], unwrapped: string[] = [];
  const ordered = [...charts].sort((a, b) => difficultyRank(a.chart.difficulty) - difficultyRank(b.chart.difficulty)
    || (a.chart.difficulty ?? "").localeCompare(b.chart.difficulty ?? ""));
  for (const c of ordered) {
    const folder = difficultyFolder(c.chart.difficulty, taken), own = packageContents(c.text, c.chart, c.files);
    for (const e of own.entries) entries.push({ path: `${folder}/${e.path}`, bytes: e.bytes });
    if (own.unwrapped) unwrapped.push(`${folder}/${own.unwrapped}`);
  }
  return { entries, unwrapped };
}

/**
 * The song and cover chart.json names, among the files open beside it. Only those: a song or image it
 * doesn't name, the game never uses.
 */
function namedFiles(chart: Pick<Chart, "music" | "cover">, files: Map<string, Uint8Array>): { song?: string; cover?: string } {
  return {
    song: chart.music?.file ? findSong(files, chart.music.file) : undefined,
    cover: chart.cover ? findCover(files, chart.cover) : undefined,
  };
}

/** The chart's own files besides chart.json - its song and cover as they are, and its clips - for saving it into a folder. */
export function ownFiles(chart: Pick<Chart, "music" | "cover">, files: Map<string, Uint8Array>): FileEntry[] {
  const { song, cover } = namedFiles(chart, files), out: FileEntry[] = [];
  for (const path of [song, cover]) if (path) out.push({ path, bytes: files.get(path)! });
  for (const [path, bytes] of files) if (/^clips\//i.test(path)) out.push({ path, bytes });
  return out;
}

/** The song and cover the chart names that aren't among these files. */
export function missingFiles(chart: Pick<Chart, "music" | "cover">, files: Map<string, Uint8Array>): string[] {
  const { song, cover } = namedFiles(chart, files);
  return [song ? undefined : chart.music?.file, cover ? undefined : chart.cover].filter((name): name is string => !!name);
}

/** Problems with the files beside the chart, for the Problems tab: a song the game can't read. */
export function fileProblems(files: Map<string, Uint8Array>, chart: Pick<Chart, "music">): string[] {
  const song = chart.music?.file ? findSong(files, chart.music.file) : undefined;
  if (song && mp3InsideWav(files.get(song)!)) return [`${song} is MP3 audio inside a WAV file, which the game can't read. Package saves it as a plain MP3.`];
  return [];
}
