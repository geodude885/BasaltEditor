// A chart's files: chart.json beside its song, cover and clips/*.json - opened loose, from a folder,
// or from a package (.bbchart, or .zip as the hosted editor saved them).
import { mp3InsideWav } from "../audio/riff";
import * as Jsonc from "../model/jsonc";
import type { Chart } from "../model/types";
import { readZip } from "./zip";

export type FileEntry = { path: string; bytes: Uint8Array };

/** What was opened: a chart (unless only extra files came), and the other files by path relative to it. */
export type Opened = { chart?: { text: string; name: string }; files: Map<string, Uint8Array> };

export const isPackage = (path: string): boolean => /\.(bbchart|zip)$/i.test(path);

/** Sorts opened files into the chart and the files beside it. */
export async function readEntries(entries: FileEntry[]): Promise<Opened> {
  const pack = entries.find(e => isPackage(e.path));
  if (pack) return unpack(await readZip(pack.bytes), pack.path.split(/[\\/]/).pop()!);
  const chart = entries.find(e => /(^|\/)chart\.json$/i.test(e.path))
    ?? entries.find(e => /\.json$/i.test(e.path) && !/clips\//i.test(e.path) && !/-(take|clip)-\d+\.json$/i.test(e.path));
  const files = new Map<string, Uint8Array>();
  for (const e of entries) if (e !== chart) files.set(relative(e.path, chart?.path), e.bytes);
  return { chart: chart && { text: new TextDecoder().decode(chart.bytes), name: chart.path.split("/").pop()! }, files };
}

/** A package's chart and files; chart.json may sit at the top or in one folder. */
export function unpack(files: Map<string, Uint8Array>, name: string): Opened {
  let prefix = "";
  if (!files.has("chart.json")) {
    const nested = [...files.keys()].find(k => /^[^/]+\/chart\.json$/.test(k));
    if (!nested) throw new Error("it has no chart.json");
    prefix = nested.slice(0, nested.indexOf("/") + 1);
  }
  const rest = new Map<string, Uint8Array>();
  for (const [k, v] of files) if (k !== prefix + "chart.json" && k.startsWith(prefix)) rest.set(k.slice(prefix.length), v);
  return { chart: { text: new TextDecoder().decode(files.get(prefix + "chart.json")), name }, files: rest };
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

export const isSong = (path: string): boolean => /\.(wav|ogg|mp3)$/i.test(path);
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

/** Recorded clips among the files, by name, with when their frames start and end - for drawing them on their tracks. */
export function clipSpans(files: Map<string, Uint8Array>): Map<string, ClipSpan> {
  const out = new Map<string, ClipSpan>();
  for (const [k, v] of files) {
    if (!/\.json$/i.test(k)) continue;
    try {
      const clip = JSON.parse(new TextDecoder().decode(v)), frames = clip.Frames ?? clip.frames;
      if (!Array.isArray(frames) || !frames.length) continue;
      const first = frames[0], last = frames[frames.length - 1];
      out.set(clip.Name ?? clip.name ?? k.split("/").pop()!.replace(/\.json$/i, ""), { start: first.T ?? first.t ?? 0, end: last.T ?? last.t ?? 0 });
    } catch { /* not a clip */ }
  }
  return out;
}

/** A package's file name for a chart. */
export const packageName = (chartName: string | undefined): string => `${(chartName || "chart").replace(/[^\w-]+/g, "-")}.bbchart`;

/**
 * What a package holds: chart.json, the chart's own song and cover, and its recorded clips - not
 * backups, other songs or anything else opened beside them. A song that is MP3 audio in a WAV wrapper
 * goes in as the plain MP3 inside, which the game can read, and the packaged chart.json names that.
 */
export function packageContents(text: string, chart: Pick<Chart, "music" | "cover">, files: Map<string, Uint8Array>): { entries: FileEntry[]; unwrapped?: string } {
  const entries: FileEntry[] = [];
  let chartText = text, unwrapped: string | undefined;
  // Only what chart.json names: a song or image it doesn't name, the game never uses.
  const song = chart.music?.file ? findSong(files, chart.music.file) : undefined;
  const cover = chart.cover ? findCover(files, chart.cover) : undefined;
  if (song) {
    const bytes = files.get(song)!, inside = mp3InsideWav(bytes);
    if (inside) {
      unwrapped = song.replace(/\.[^./]*$/, "") + ".mp3";
      entries.push({ path: unwrapped, bytes: inside });
      chartText = Jsonc.set(chartText, "music", { ...chart.music, file: unwrapped });
    } else entries.push({ path: song, bytes });
  }
  if (cover) entries.push({ path: cover, bytes: files.get(cover)! });
  for (const [path, bytes] of files) if (/^clips\//i.test(path)) entries.push({ path, bytes });
  return { entries: [{ path: "chart.json", bytes: new TextEncoder().encode(chartText) }, ...entries], unwrapped };
}

/** Problems with the files beside the chart, for the Problems tab: a song the game can't read. */
export function fileProblems(files: Map<string, Uint8Array>, chart: Pick<Chart, "music">): string[] {
  const song = chart.music?.file ? findSong(files, chart.music.file) : undefined;
  if (song && mp3InsideWav(files.get(song)!)) return [`${song} is MP3 audio inside a WAV file, which the game can't read - Package saves it as a plain MP3, or convert it`];
  return [];
}
