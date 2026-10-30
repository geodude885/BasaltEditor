// Opening and saving: through the desktop app's dialogs, by drag and drop, and the clipboard.
import { isDesktop, type OpenedFolder } from "../../../shared/api";
import { folderNamedAfter } from "../../../shared/folders";
import { clipSpans, findCover, findSong, isCover, isSong, ownFiles, packageContents, packageName, readEntries, type FileEntry } from "../io/files";
import { setMusic } from "../model/edits";
import { writeZip } from "../io/zip";
import { template } from "../model/samples";
import { loadChart, toast } from "./actions";
import { doc } from "./document.svelte";
import { session } from "./session.svelte";
import { ui } from "./ui.svelte";
import { loadSong, unloadSong } from "./playback";

const api = () => window.editor;

/**
 * Your charts, as far as opening and saving need it. The library (store/library.svelte.ts) registers
 * itself here when it starts, so it can open charts through this module without this one importing
 * it back. Without one - no library here - there is nothing to keep charts in.
 */
export interface ChartKeeper {
  readonly available: boolean;
  /** Keeps changes as they're made (the browser), rather than on Save (the Charts folder). */
  readonly autosaves: boolean;
  /** Keeps the open chart's latest changes now. False if that failed. */
  flush(): Promise<boolean>;
  /** A chart was just saved into it, from here. */
  saved(): void;
}
let keeper: ChartKeeper | null = null;
export function keepChartsWith(k: ChartKeeper): void { keeper = k; }

/** The chart folder's files as they are on disk, by path - so Save writes only a song or cover that is new or changed. */
let onDisk = new Map<string, Uint8Array>();

/**
 * Where Save puts the open chart: into its folder; into a new folder in the game's Charts folder, so it
 * is one of Your charts (the desktop app, with the game installed); into Your charts in the browser;
 * or, with none of those, into a chart.json file it asks for.
 */
export function saveTarget(): "folder" | "new-folder" | "library" | "file" {
  if (session.folder) return "folder";
  if (keeper?.available && isDesktop(api())) return "new-folder";
  return keeper?.available && keeper.autosaves ? "library" : "file";
}

/** The desktop app's frame and dialogs in the page's theme. Nothing to do in a browser. */
export function followTheme(choice: "system" | "dark" | "light"): void {
  void window.editor?.setTheme(choice);
}

function clearFiles(): void {
  session.files = new Map();
  session.clips = new Map();
  if (session.cover) URL.revokeObjectURL(session.cover);
  session.cover = null;
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
      session.folder = folder;
      session.folderNamedFor = chartNaming();
      onDisk = folder ? new Map(opened.files) : new Map();
      joinLibrary();
    }
    session.files = new Map([...session.files, ...opened.files]);
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
  const songKey = findSong(session.files, named) ?? (named ? findSong(session.files) : undefined);
  if (named && songKey && !findSong(session.files, named)) toast(`${named} isn't open, so playing ${songKey}. Change the song in the Chart tab.`);
  if (songKey && session.song?.name !== songKey) {
    if (!await loadSong(songKey, session.files.get(songKey)!)) toastUndecodable(songKey);
    if (!named) doc.change(["music"], () => { doc.chart.music = { file: songKey, start: 0, volume: 1 }; });
  }
  const coverKey = findCover(session.files, doc.chart.cover);
  if (coverKey) {
    showCover(session.files.get(coverKey)!);
    if (!doc.chart.cover) doc.change(["cover"], () => { doc.chart.cover = coverKey; });
  }
  session.clips = clipSpans(session.files);
}

/** Picks a song on its own and makes it the chart's, replacing the one before. */
export async function chooseSong(): Promise<void> {
  const [file] = await api().openFiles("song");
  if (!file) return;
  const name = file.path.split(/[\\/]/).pop()!;
  if (!isSong(name)) { toast("Not a song. Choose an MP3, OGG or WAV file"); return; }
  session.files = new Map([...session.files, [name, file.bytes]]);
  await useSong(name);
}

/** Makes one of the open songs the chart's song, and plays it from now on. */
export async function useSong(name: string): Promise<void> {
  const bytes = session.files.get(name);
  if (!bytes) return;
  nameSong(name);
  // Load it even if a song of the same name was open: this may be a different file.
  if (!await loadSong(name, bytes)) toastUndecodable(name);
  else toast(`Song: ${name}`);
}

const toastUndecodable = (name: string): void => toast(`Couldn't draw a waveform for ${name}`);

/** Shows a cover image, letting go of the one before. */
function showCover(bytes: Uint8Array): void {
  if (session.cover) URL.revokeObjectURL(session.cover);
  session.cover = URL.createObjectURL(new Blob([bytes as BlobPart]));
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
  if (!isCover(name)) { toast("Not a cover. Choose a PNG or JPEG image"); return; }
  session.files = new Map([...session.files, [name, file.bytes]]);
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
  try { session.recentFolders = await api().recentFolders?.() ?? []; } catch { /* keep the list as it was */ }
}

/**
 * Before another chart replaces the open one: in the desktop app, unsaved changes are saved, thrown
 * away or kept by asking. False to leave the open chart alone. On the web the library keeps them -
 * saved now, not when its timer would have, which would be after the next chart had replaced them.
 */
export async function mayReplaceChart(): Promise<boolean> {
  await keeper?.flush();
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

/** Starts a chart from the template - in the desktop app, straight into a new folder among Your charts. */
export async function newChart(): Promise<void> {
  if (!await mayReplaceChart()) return;
  loadChart(template("My Chart"), "chart.json");
  clearFiles();
  session.folder = null;
  onDisk = new Map();
  joinLibrary();
  if (saveTarget() === "new-folder") await saveToCharts("Started");
}

/** A chart just opened or started: a new entry in your charts, where there is a library. */
function joinLibrary(): void {
  session.libraryId = null;
  session.libraryAdd = true;
}

/** Opens a chart kept in your charts, with its files - and its folder, on the desktop. The library says which entry it is. */
export async function openStored(text: string, name: string, files: Map<string, Uint8Array>, folder: string | null = null): Promise<void> {
  loadChart(text, name);
  clearFiles();
  session.folder = folder;
  session.folderNamedFor = chartNaming();
  session.files = new Map(files);
  onDisk = folder ? new Map(files) : new Map();
  if (folder) void refreshRecent();
  await useFiles();
}

/**
 * Saving a chart the game will not load is allowed - it may be work in progress - but never
 * silently: the Problems tab opens and the message says so.
 */
function savedNote(what: string): string {
  const n = session.problems.length;
  if (!n) return what;
  ui.revealTab("problems");
  return `${what}, but the game won't load it until its ${n} problem${n === 1 ? " is" : "s are"} fixed`;
}

/**
 * Saves the chart where saveTarget says. Into a folder: chart.json, and the song or cover if it is new
 * there. In the browser, Your charts keeps it already; Save just makes sure, now.
 */
export async function save(): Promise<void> {
  const target = saveTarget(), folder = session.folder;
  if (target === "new-folder") { await saveToCharts("Saved"); return; }
  if (target === "file") { await saveChartAs(); return; }
  if (target === "library") {
    session.libraryAdd = true;
    if (keeper && !await keeper.flush()) return;
    doc.markSaved();
    toast(savedNote("Saved in Your charts"));
    return;
  }
  if (!folder) return;
  try {
    await api().saveChart(folder, doc.text);
    const changed = ownFiles(doc.chart, session.files).filter(f => onDisk.get(f.path) !== f.bytes);
    if (changed.length && api().saveFiles) {
      await api().saveFiles!(folder, changed);
      for (const f of changed) onDisk.set(f.path, f.bytes);
    }
    doc.markSaved();
    toast(savedNote(await followChartName(folder)));
  } catch (e) {
    toast(`Could not save: ${(e as Error).message}`);
  }
}

/** What a chart's folder is named from: its name and difficulty. */
const chartNaming = () => ({ name: doc.chart.name ?? "", difficulty: doc.chart.difficulty });
const folderOf = (path: string) => path.split(/[\\/]/).pop() ?? path;

/**
 * After a save into a folder of the game's Charts folder: if the chart's name or difficulty changed since
 * the folder was opened or last saved, and the folder was named after them, rename it to match. A folder
 * named by hand stays as it is. Says what happened, for the save's message.
 */
async function followChartName(folder: string): Promise<string> {
  const before = session.folderNamedFor, now = chartNaming();
  session.folderNamedFor = now;
  const changed = !!before && (before.name !== now.name || before.difficulty !== now.difficulty);
  if (!changed || !api().renameChartFolder || !folderNamedAfter(folderOf(folder), before.name, before.difficulty)) return "Saved";
  try {
    const moved = await api().renameChartFolder!(folder, now.name, now.difficulty);
    if (moved === folder) return "Saved";
    session.folder = moved;
    void refreshRecent();
    return `Saved, and its folder is now ${folderOf(moved)}`;
  } catch {
    // Try again at the next save; the game may have let go of it by then.
    session.folderNamedFor = before;
    return "Saved, but its folder couldn't be renamed (the game may have it open)";
  }
}

/** Gives a chart with no folder one in the game's Charts folder, named after it, with its song, cover and clips. */
async function saveToCharts(what: string): Promise<void> {
  const own = ownFiles(doc.chart, session.files), name = doc.chart.name || "My Chart";
  try {
    const folder = await api().createChartFolder!(name, [{ path: "chart.json", bytes: new TextEncoder().encode(doc.text) }, ...own], doc.chart.difficulty);
    session.folder = folder;
    session.folderNamedFor = chartNaming();
    onDisk = new Map(own.map(f => [f.path, f.bytes]));
    doc.markSaved();
    void refreshRecent();
    keeper?.saved();
    toast(savedNote(`${what} in Your charts, as ${folder.split(/[\\/]/).pop()} in the game's Charts folder`));
  } catch (e) {
    toast(`Could not save into the game's Charts folder: ${(e as Error).message}`);
  }
}

export async function saveChartAs(): Promise<void> {
  await saveFile("chart.json", new TextEncoder().encode(doc.text), true);
}

/** A package (.bbchart) with the song, cover and clips - it goes into the game's Charts folder as it is. */
export async function savePackage(): Promise<void> {
  const { entries, unwrapped } = packageContents(doc.text, doc.chart, session.files);
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
    toast(savedNote("Copied chart.json. Paste it over your chart's file"));
  } catch {
    ui.revealTab("help");
    ui.showText = true;
  }
}
