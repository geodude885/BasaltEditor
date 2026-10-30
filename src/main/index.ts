import { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } from "electron";
import { cpSync, existsSync, readFileSync } from "node:fs";
import { cp, mkdir, readdir, readFile, realpath, rename, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import updater from "electron-updater";
import { chartFolderName, freeNames } from "../shared/folders";
import { Channels, type ChartFolder, type DuplicatedFolder, type FileKind, type OpenedFile, type OpenedFolder, type UnsavedChoice } from "../shared/api";

/** Chart folders this session opened - the only places saveChart may write. */
const openedFolders = new Set<string>();

/** Ctrl and these keys zoom the page in or out, by the default menu's steps. */
const PAGE_ZOOM_STEPS: Record<string, number> = { "=": 0.5, "+": 0.5, "-": -0.5 };

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    // The page sets the theme once it loads; until then, the system's.
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#131415" : "#f4f2ee",
    autoHideMenuBar: true,
    // Windows and macOS take the icon from the installed app; Linux windows need telling.
    ...(process.platform === "linux" && { icon: join(import.meta.dirname, "../renderer/icon.png") }),
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, "../preload/index.cjs"),
      sandbox: true,
      contextIsolation: true,
    },
  });
  window.once("ready-to-show", () => window.show());
  // The page draws its own menu bar. Electron's default menu would come back on Alt, so it goes - except
  // on macOS, where the app menu lives outside the window and gives text boxes Cmd C / V.
  if (process.platform !== "darwin") window.removeMenu();
  // What the default menu used to give: developer tools on F12, and zooming the page with Ctrl + / - / 0.
  window.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F12") { window.webContents.toggleDevTools(); return; }
    if (process.platform === "darwin" || !input.control || input.alt || input.meta) return;
    const contents = window.webContents, step = PAGE_ZOOM_STEPS[input.key];
    if (input.key === "0") contents.setZoomLevel(0);
    else if (step) contents.setZoomLevel(contents.getZoomLevel() + step);
    else return;
    event.preventDefault();
  });
  // Links open in the browser, never in the app.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", event => event.preventDefault());

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void window.loadFile(join(import.meta.dirname, "../renderer/index.html"));
}

/** Where the game keeps charts, if RUMBLE is installed somewhere usual - where dialogs start. */
function chartsFolder(): string | undefined {
  // Another folder stands in for the game's, for trying the editor without touching real charts.
  const instead = process.env.BASALT_CHARTS_FOLDER;
  if (instead) return existsSync(instead) ? resolve(instead) : undefined;
  const steam = process.platform === "win32"
    ? ["C:/Program Files (x86)/Steam", "C:/Program Files/Steam"]
    : [join(homedir(), ".steam/steam"), join(homedir(), ".local/share/Steam")];
  for (const root of steam) {
    const folder = join(root, "steamapps/common/RUMBLE/UserData/Basalt/Charts");
    if (existsSync(folder)) return folder;
  }
  return undefined;
}

async function readAll(paths: string[], name: (path: string) => string): Promise<OpenedFile[]> {
  return Promise.all(paths.map(async path => ({ path: name(path), bytes: new Uint8Array(await readFile(path)) })));
}

const PICKERS: Record<FileKind | "all", { title: string; name: string; extensions: string[]; several: boolean }> = {
  all: { title: "Open chart files", name: "Charts, songs, covers and clips", extensions: ["json", "bbchart", "zip", "ogg", "mp3", "png", "jpg", "jpeg"], several: true },
  song: { title: "Choose the song", name: "Songs", extensions: ["mp3", "ogg"], several: false },
  cover: { title: "Choose the cover", name: "Images", extensions: ["png", "jpg", "jpeg"], several: false },
};

ipcMain.handle(Channels.openFiles, async (event, kind?: FileKind): Promise<OpenedFile[]> => {
  const window = BrowserWindow.fromWebContents(event.sender)!;
  const picker = PICKERS[kind === "song" || kind === "cover" ? kind : "all"];
  const picked = await dialog.showOpenDialog(window, {
    title: picker.title,
    defaultPath: chartsFolder(),
    properties: picker.several ? ["openFile", "multiSelections"] : ["openFile"],
    filters: [{ name: picker.name, extensions: picker.extensions }, { name: "All files", extensions: ["*"] }],
  });
  return picked.canceled ? [] : readAll(picked.filePaths, basename);
});

ipcMain.handle(Channels.openFolder, async (event): Promise<OpenedFolder | null> => {
  const window = BrowserWindow.fromWebContents(event.sender)!;
  const picked = await dialog.showOpenDialog(window, { title: "Open a chart folder", defaultPath: chartsFolder(), properties: ["openDirectory"] });
  if (picked.canceled || !picked.filePaths[0]) return null;
  return readFolder(resolve(picked.filePaths[0]));
});

/** Reads chart.json, the files beside it and clips/; the folder then counts as opened, and recent. */
async function readFolder(folder: string): Promise<OpenedFolder> {
  const paths: string[] = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    if (entry.isFile()) paths.push(join(folder, entry.name));
    else if (entry.isDirectory() && entry.name.toLowerCase() === "clips") {
      for (const clip of await readdir(join(folder, entry.name), { withFileTypes: true })) {
        if (clip.isFile()) paths.push(join(folder, entry.name, clip.name));
      }
    }
  }
  openedFolders.add(folder);
  rememberRecent(folder);
  const files = await readAll(paths, path => path.slice(folder.length + 1).replace(/\\/g, "/"));
  return { folder, files };
}

// "Your charts" on the desktop: the chart folders in the game's Charts folder. The page names folders
// by path, so each call checks the folder is one it may touch - a chart folder straight inside the
// Charts folder, or (for reading) one opened before.

/**
 * The folder, resolved, if it is a chart folder (one with chart.json) straight inside the Charts
 * folder; else an error. Checked on the real paths, so a link inside the Charts folder can't lead
 * out of it - but the path handed back is the one asked about, which is how the page knows it.
 */
async function chartFolderIn(folder: string): Promise<string> {
  const charts = chartsFolder(), target = resolve(folder);
  const refuse = () => new Error("that isn't a chart folder in the game's Charts folder");
  if (!charts || !existsSync(join(target, "chart.json"))) throw refuse();
  const [realCharts, realTarget] = await Promise.all([realpath(charts), realpath(target)]);
  if (relative(realCharts, dirname(realTarget)) !== "") throw refuse();
  return target;
}

/** Images beside chart.json, any of which may be its cover. */
const IMAGE = /\.(png|jpe?g)$/i;
/** Bigger images are left off the cards. */
const COVER_MOST_BYTES = 4 * 1024 * 1024;

ipcMain.handle(Channels.chartsFolder, () => chartsFolder() ?? null);

ipcMain.handle(Channels.listCharts, async (): Promise<ChartFolder[]> => {
  const charts = chartsFolder();
  if (!charts) return [];
  const found: ChartFolder[] = [];
  for (const entry of await readdir(charts, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const folder = join(charts, entry.name), chartPath = join(folder, "chart.json");
    if (!existsSync(chartPath)) continue;
    try {
      const [text, info, names] = await Promise.all([readFile(chartPath, "utf8"), stat(chartPath), readdir(folder, { withFileTypes: true })]);
      const images = names.filter(n => n.isFile() && IMAGE.test(n.name)).map(n => n.name);
      found.push({ folder, text, modified: info.mtimeMs, images });
    } catch (e) {
      console.error("could not read", folder, e);
    }
  }
  return found;
});

ipcMain.handle(Channels.readCover, async (_event, folder: string, name: string): Promise<Uint8Array | null> => {
  const target = await chartFolderIn(folder);
  if (basename(name) !== name || !IMAGE.test(name)) throw new Error("that isn't an image beside chart.json");
  const path = join(target, name);
  if ((await stat(path)).size > COVER_MOST_BYTES) return null;
  return new Uint8Array(await readFile(path));
});

ipcMain.handle(Channels.readFolder, async (_event, folder: string): Promise<OpenedFolder> => {
  const target = resolve(folder);
  if (!recentFolders.includes(target) && !openedFolders.has(target)) await chartFolderIn(target);
  return readFolder(target);
});

ipcMain.handle(Channels.duplicateFolder, async (_event, folder: string): Promise<DuplicatedFolder> => {
  const source = await chartFolderIn(folder);
  let copy = `${source} (copy)`;
  for (let n = 2; existsSync(copy); n++) copy = `${source} (copy ${n})`;
  await cp(source, copy, { recursive: true, errorOnExist: true });
  openedFolders.add(copy);
  return { folder: copy, text: await readFile(join(copy, "chart.json"), "utf8") };
});

// Renames a chart folder in the Charts folder after its chart's name and difficulty, keeping it opened and
// in the recent list under its new name. The game may hold the folder (recording into it), and then the
// rename fails - the page says so.
ipcMain.handle(Channels.renameChartFolder, async (_event, folder: string, chartName: string, difficulty?: string): Promise<string> => {
  const source = await chartFolderIn(folder), target = await freeChartFolder(dirname(source), chartFolderName(chartName, difficulty), source);
  if (target === source) return source;
  await rename(source, target);
  if (openedFolders.delete(source)) openedFolders.add(target);
  recentFolders = recentFolders.map(f => (f === source ? target : f));
  saveRecent();
  return target;
});

ipcMain.handle(Channels.trashFolder, async (_event, folder: string): Promise<void> => {
  const target = await chartFolderIn(folder);
  await shell.trashItem(target);
  openedFolders.delete(target);
  recentFolders = recentFolders.filter(f => f !== target);
  saveRecent();
});

// Recent folders, newest first, kept in the app's own data folder.
const RECENT_KEPT = 8;
const recentFile = (): string => join(app.getPath("userData"), "recent-folders.json");
let recentFolders: string[] = [];

function loadRecent(): void {
  try {
    const list: unknown = JSON.parse(readFileSync(recentFile(), "utf8"));
    if (Array.isArray(list)) recentFolders = list.filter((f): f is string => typeof f === "string" && existsSync(f)).slice(0, RECENT_KEPT);
  } catch { /* none yet */ }
}

function saveRecent(): void {
  writeFile(recentFile(), JSON.stringify(recentFolders)).catch(e => console.error("could not keep the recent folders:", e));
}

function rememberRecent(folder: string): void {
  recentFolders = [folder, ...recentFolders.filter(f => f !== folder)].slice(0, RECENT_KEPT);
  saveRecent();
}

ipcMain.handle(Channels.recentFolders, () => recentFolders.filter(f => existsSync(f)));

ipcMain.handle(Channels.askUnsaved, async (event, name: string): Promise<UnsavedChoice> => {
  const window = BrowserWindow.fromWebContents(event.sender)!;
  const { response } = await dialog.showMessageBox(window, {
    type: "warning",
    message: `Save the changes to ${name}?`,
    detail: "They'll be lost if you don't save them.",
    buttons: ["Save", "Don't save", "Cancel"],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
  });
  return response === 0 ? "save" : response === 1 ? "discard" : "cancel";
});

ipcMain.handle(Channels.saveChart, async (_event, folder: string, text: string): Promise<void> => {
  await writeFile(join(openedFolder(folder), "chart.json"), text, "utf8");
});

/** The folder, resolved, if this session opened it (or made it); else an error. */
function openedFolder(folder: string): string {
  const target = resolve(folder);
  if (!openedFolders.has(target)) throw new Error("that folder was not opened in this session");
  return target;
}

/**
 * Where a chart's file goes inside its folder, if it is a place a chart's file may go: beside
 * chart.json, or in clips/ - never anywhere else, however the page names it.
 */
function chartFilePath(folder: string, path: string): string {
  const parts = path.split(/[\\/]/);
  const fine = (name: string) => !!name && name !== "." && name !== ".." && !/[<>:"|?*\0]/.test(name);
  if (!parts.every(fine) || !(parts.length === 1 || (parts.length === 2 && parts[0].toLowerCase() === "clips"))) {
    throw new Error(`${path} isn't a place for a chart's file`);
  }
  return join(folder, ...parts);
}

async function writeChartFiles(folder: string, files: OpenedFile[]): Promise<void> {
  for (const file of files) {
    const path = chartFilePath(folder, file.path);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, file.bytes);
  }
}

ipcMain.handle(Channels.saveFiles, async (_event, folder: string, files: OpenedFile[]): Promise<void> => {
  await writeChartFiles(openedFolder(folder), files);
});

/** The first free candidate for a folder name in the Charts folder; `except` (the folder being renamed) counts as free. */
async function freeChartFolder(charts: string, wanted: string, except?: string): Promise<string> {
  const exceptReal = except ? await realpath(except) : null;
  for (const name of freeNames(wanted)) {
    const folder = join(charts, name);
    // A rename that only changes case finds the folder itself: it's free for it.
    if (!existsSync(folder) || (exceptReal && await realpath(folder) === exceptReal)) return folder;
  }
  throw new Error("no free folder name");
}

ipcMain.handle(Channels.createChartFolder, async (_event, chartName: string, files: OpenedFile[], difficulty?: string): Promise<string> => {
  const charts = chartsFolder();
  if (!charts) throw new Error("the game's Charts folder isn't here");
  const folder = await freeChartFolder(charts, chartFolderName(chartName, difficulty));
  await mkdir(folder);
  openedFolders.add(folder);
  await writeChartFiles(folder, files);
  rememberRecent(folder);
  return folder;
});

ipcMain.handle(Channels.saveFile, async (event, suggestedName: string, bytes: Uint8Array): Promise<string | null> => {
  const window = BrowserWindow.fromWebContents(event.sender)!;
  const extension = suggestedName.split(".").pop() ?? "";
  const picked = await dialog.showSaveDialog(window, {
    title: "Save",
    defaultPath: join(chartsFolder() ?? app.getPath("documents"), basename(suggestedName)),
    filters: [{ name: extension === "bbchart" ? "Chart package" : extension.toUpperCase(), extensions: [extension] }],
  });
  if (picked.canceled || !picked.filePath) return null;
  await writeFile(picked.filePath, bytes);
  return picked.filePath;
});

ipcMain.handle(Channels.setTheme, (_event, theme: "system" | "dark" | "light") => {
  if (["system", "dark", "light"].includes(theme)) nativeTheme.themeSource = theme;
});

/** Basalt Editor was the Boss Battles Chart Editor: bring its saved storage (the draft, settings) across once. */
function moveOldStorage(): void {
  const old = join(app.getPath("appData"), "Boss Battles Chart Editor", "Local Storage");
  const now = join(app.getPath("userData"), "Local Storage");
  if (existsSync(now) || !existsSync(old)) return;
  try { cpSync(old, now, { recursive: true }); } catch (e) { console.error("could not move the old storage:", e); }
}

void app.whenReady().then(() => {
  moveOldStorage();
  loadRecent();
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  // Installed copies update themselves from GitHub Releases.
  if (app.isPackaged) updater.autoUpdater.checkForUpdatesAndNotify().catch(e => console.error("update check failed:", e));
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
