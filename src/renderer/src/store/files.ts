// Opening and saving: through the desktop app's dialogs, by drag and drop, and the clipboard.
import type { OpenedFolder } from "../../../shared/api";
import { clipSpans, findCover, findSong, isCover, isSong, packageContents, packageName, readEntries, type FileEntry } from "../io/files";
import { setMusic } from "../model/edits";
import { writeZip } from "../io/zip";
import { template } from "../model/samples";
import { loadChart, toast } from "./actions";
import { doc } from "./document.svelte";
import { editor } from "./editor.svelte";
// library.svelte.ts imports this module too; each only calls the other from inside functions.
import { library } from "./library.svelte";
import { loadSong, unloadSong } from "./playback";

const api = () => window.editor;

/** The desktop app's frame and dialogs in the page's theme. Nothing to do in a browser. */
export function followTheme(choice: "system" | "dark" | "light"): void {
  void window.editor?.setTheme(choice);
}

function clearFiles(): void {
  editor.files = new Map();
  editor.clips = new Map();
  if (editor.cover) URL.revokeObjectURL(editor.cover);
  editor.cover = null;
  unloadSong();
}

/** Opens a chart with the files beside it, or adds files to the open chart. */
export async function openEntries(entries: FileEntry[], folder: string | null = null): Promise<void> {
  try {
    const opened = await readEntries(entries);
    if (opened.chart && !await mayReplaceChart()) return;
    if (opened.chart) {
      loadChart(opened.chart.text, opened.chart.name);
      clearFiles();
      editor.folder = folder;
      joinLibrary();
    }
    editor.files = new Map([...editor.files, ...opened.files]);
    if (folder) void refreshRecent();
    // A song or cover opened on its own (not with a chart) becomes the chart's, replacing the one before.
    const song = opened.chart ? undefined : await adopt([...opened.files.keys()]);
    await useFiles();
    const extra = opened.files.size ? ` with ${opened.files.size} file(s)` : "";
    // A song opened on its own has said so already (useSong).
    if (opened.chart) toast(`Opened ${doc.chart.name || opened.chart.name}${extra}`);
    else if (!song) toast(`Added ${opened.files.size} file(s)`);
  } catch (e) {
    toast(`Could not open that: ${(e as Error).message}`);
  }
}

/** Makes the first song and the first cover among newly opened files the chart's own. */
async function adopt(paths: string[]): Promise<string | undefined> {
  const song = paths.find(isSong), cover = paths.find(isCover);
  if (cover && cover !== doc.chart.cover) doc.change(["cover"], () => { doc.chart.cover = cover; });
  // Loaded even when the name is the same as before: it may be a different file.
  if (song) await useSong(song);
  return song;
}

/** Names the chart's song, keeping where it starts and how loud it is. */
function nameSong(file: string): void {
  const m = doc.chart.music;
  doc.change(["music"], () => setMusic(doc.chart, file, m?.start ?? 0, m?.volume ?? 1));
}

/** Puts the opened files to use: the song (playing and its waveform), the cover, and recorded clips. */
async function useFiles(): Promise<void> {
  const named = doc.chart.music?.file;
  // The song the chart names; if it isn't among the files but another song is, that one plays meanwhile.
  const songKey = findSong(editor.files, named) ?? (named ? findSong(editor.files) : undefined);
  if (named && songKey && !findSong(editor.files, named)) toast(`The chart names ${named}, which isn't open - playing ${songKey}. Choose a song in Chart to change it.`);
  if (songKey && editor.song?.name !== songKey) {
    if (!await loadSong(songKey, editor.files.get(songKey)!)) toastUndecodable(songKey);
    if (!named) doc.change(["music"], () => { doc.chart.music = { file: songKey, start: 0, volume: 1 }; });
  }
  const coverKey = findCover(editor.files, doc.chart.cover);
  if (coverKey) {
    showCover(editor.files.get(coverKey)!);
    if (!doc.chart.cover) doc.change(["cover"], () => { doc.chart.cover = coverKey; });
  }
  editor.clips = clipSpans(editor.files);
}

/** Picks a song on its own and makes it the chart's, replacing the one before. */
export async function chooseSong(): Promise<void> {
  const [file] = await api().openFiles("song");
  if (!file) return;
  const name = file.path.split(/[\\/]/).pop()!;
  if (!isSong(name)) { toast("That isn't a song - choose an MP3, OGG or WAV file"); return; }
  editor.files = new Map([...editor.files, [name, file.bytes]]);
  await useSong(name);
}

/** Makes one of the open songs the chart's song, and plays it from now on. */
export async function useSong(name: string): Promise<void> {
  const bytes = editor.files.get(name);
  if (!bytes) return;
  nameSong(name);
  // Load it even if a song of the same name was open: this may be a different file.
  if (!await loadSong(name, bytes)) toastUndecodable(name);
  else toast(`Song: ${name}`);
}

const toastUndecodable = (name: string): void => toast(`${name} could not be decoded for the waveform - it still plays if it can`);

/** Shows a cover image, letting go of the one before. */
function showCover(bytes: Uint8Array): void {
  if (editor.cover) URL.revokeObjectURL(editor.cover);
  editor.cover = URL.createObjectURL(new Blob([bytes as BlobPart]));
}

/** Takes the song out of the chart. */
export function removeSong(): void {
  doc.change(["music"], () => setMusic(doc.chart, "", 0, 1));
  unloadSong();
}

/** Picks a cover image on its own and makes it the chart's. */
export async function chooseCover(): Promise<void> {
  const [file] = await api().openFiles("cover");
  if (!file) return;
  const name = file.path.split(/[\\/]/).pop()!;
  if (!isCover(name)) { toast("That isn't a cover - choose a PNG or JPEG image"); return; }
  editor.files = new Map([...editor.files, [name, file.bytes]]);
  doc.change(["cover"], () => { doc.chart.cover = name; });
  showCover(file.bytes);
}

export async function openFiles(): Promise<void> {
  const files = await api().openFiles();
  if (files.length) await openEntries(files);
}

export async function openFolder(): Promise<void> {
  try {
    const opened = await api().openFolder();
    if (opened) await openOpenedFolder(opened);
  } catch (e) {
    toast(`Could not open that folder: ${(e as Error).message}`);
  }
}

/** Opens a chart folder opened lately, without asking where (the desktop app). */
export async function openRecent(folder: string): Promise<void> {
  try {
    const opened = await api().readFolder?.(folder);
    if (opened) await openOpenedFolder(opened);
  } catch (e) {
    toast(`Could not open that folder: ${(e as Error).message}`);
    void refreshRecent();
  }
}

async function openOpenedFolder(opened: OpenedFolder): Promise<void> {
  if (!opened.files.some(f => f.path.toLowerCase() === "chart.json")) { toast("That folder has no chart.json"); return; }
  await openEntries(opened.files, opened.folder);
}

/** The chart folders opened lately, for File > Open recent. Nothing in a browser. */
export async function refreshRecent(): Promise<void> {
  try { editor.recentFolders = await api().recentFolders?.() ?? []; } catch { /* keep the list as it was */ }
}

/**
 * Before another chart replaces the open one: in the desktop app, unsaved changes are saved, thrown
 * away or kept by asking. False to leave the open chart alone. On the web the library keeps them -
 * saved now, not when its timer would have, which would be after the next chart had replaced them.
 */
export async function mayReplaceChart(): Promise<boolean> {
  await library.flush();
  const ask = api().askUnsaved;
  if (!doc.dirty || !ask) return true;
  const choice = await ask(doc.chart.name || "Untitled");
  if (choice === "discard") return true;
  if (choice === "cancel") return false;
  await save();
  return !doc.dirty;
}

/** Files dropped on the window. */
export async function openDropped(files: File[]): Promise<void> {
  await openEntries(await Promise.all(files.map(async f => ({ path: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }))));
}

export async function newChart(): Promise<void> {
  if (!await mayReplaceChart()) return;
  loadChart(template("My Chart"), "chart.json");
  clearFiles();
  editor.folder = null;
  joinLibrary();
}

/** A chart just opened or started: a new entry in your charts, where there is a library. */
function joinLibrary(): void {
  editor.libraryId = null;
  editor.libraryAdd = true;
}

/** Opens a chart kept in your charts, with its files - and its folder, on the desktop. The library says which entry it is. */
export async function openStored(text: string, name: string, files: Map<string, Uint8Array>, folder: string | null = null): Promise<void> {
  loadChart(text, name);
  clearFiles();
  editor.folder = folder;
  editor.files = new Map(files);
  if (folder) void refreshRecent();
  await useFiles();
}

/**
 * Saving a chart the game will not load is allowed - it may be work in progress - but never
 * silently: the Problems tab opens and the message says so.
 */
function savedNote(what: string): string {
  const n = editor.problems.length;
  if (!n) return what;
  editor.tab = "problems";
  return `${what} - but it has ${n} problem${n === 1 ? "" : "s"}, so the game will not load it until they are fixed`;
}

/** Saves into the open folder, or asks where to save chart.json. */
export async function save(): Promise<void> {
  if (!editor.folder) { await saveChartAs(); return; }
  try {
    await api().saveChart(editor.folder, doc.text);
    doc.markSaved();
    toast(savedNote("Saved chart.json - the game reloads it within a second"));
  } catch (e) {
    toast(`Could not save: ${(e as Error).message}`);
  }
}

export async function saveChartAs(): Promise<void> {
  await saveFile("chart.json", new TextEncoder().encode(doc.text), true);
}

/** A package (.bbchart) with the song, cover and clips - it goes into the game's Charts folder as it is. */
export async function savePackage(): Promise<void> {
  const { entries, unwrapped } = packageContents(doc.text, doc.chart, editor.files);
  const zip = writeZip(entries.map(e => [e.path, e.bytes]));
  await saveFile(packageName(doc.chart.name), zip, false);
  if (unwrapped) toast(`The song went in as ${unwrapped}: it was MP3 audio inside a WAV file, which the game can't read`);
}

async function saveFile(name: string, bytes: Uint8Array, isChart: boolean): Promise<void> {
  try {
    const path = await api().saveFile(name, bytes);
    if (!path) return;
    if (isChart) doc.markSaved();
    toast(savedNote(`Saved ${path}`));
  } catch (e) {
    toast(`Could not save ${name}: ${(e as Error).message}`);
  }
}

export async function copyChart(): Promise<void> {
  try {
    await navigator.clipboard.writeText(doc.text);
    toast(savedNote("Copied chart.json - paste it over your chart's file; the game reloads it"));
  } catch {
    editor.tab = "help";
    editor.showText = true;
  }
}
