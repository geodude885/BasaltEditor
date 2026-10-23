import { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } from "electron";
import { cpSync, existsSync, readFileSync } from "node:fs";
import { cp, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import updater from "electron-updater";
import { Channels, type ChartFolder, type FileKind, type OpenedFile, type OpenedFolder, type UnsavedChoice } from "../shared/api";

/** Chart folders this session opened - the only places saveChart may write. */
const openedFolders = new Set<string>();

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
  // Developer tools on F12, which the default menu used to give.
  window.webContents.on("before-input-event", (_, input) => {
    if (input.type === "keyDown" && input.key === "F12") window.webContents.toggleDevTools();
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
  all: { title: "Open chart files", name: "Charts, songs, covers and clips", extensions: ["json", "bbchart", "zip", "wav", "ogg", "mp3", "png", "jpg", "jpeg"], several: true },
  song: { title: "Choose the song", name: "Songs", extensions: ["mp3", "ogg", "wav"], several: false },
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
// by path, so each call checks the folder is one it may touch - in the Charts folder, or (for reading)
// one opened before.

/** Whether `child` is somewhere inside `parent`. */
function isInside(parent: string, child: string): boolean {
  const rel = relative(resolve(parent), resolve(child));
  return !!rel && !rel.startsWith("..") && !isAbsolute(rel);
}

/** The folder, resolved, if it is in the Charts folder; else an error. */
function inCharts(folder: string): string {
  const charts = chartsFolder(), target = resolve(folder);
  if (!charts || !isInside(charts, target)) throw new Error("that folder isn't in the game's Charts folder");
  return target;
}

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
      const images: OpenedFile[] = [];
      for (const name of names) {
        if (!name.isFile() || !/\.(png|jpe?g)$/i.test(name.name)) continue;
        const path = join(folder, name.name);
        if ((await stat(path)).size <= COVER_MOST_BYTES) images.push({ path: name.name, bytes: new Uint8Array(await readFile(path)) });
      }
      found.push({ folder, text, modified: info.mtimeMs, images });
    } catch (e) {
      console.error("could not read", folder, e);
    }
  }
  return found;
});

ipcMain.handle(Channels.readFolder, async (_event, folder: string): Promise<OpenedFolder> => {
  const target = resolve(folder);
  if (!recentFolders.includes(target) && !openedFolders.has(target)) inCharts(target);
  return readFolder(target);
});

ipcMain.handle(Channels.duplicateFolder, async (_event, folder: string): Promise<string> => {
  const source = inCharts(folder);
  let copy = `${source} (copy)`;
  for (let n = 2; existsSync(copy); n++) copy = `${source} (copy ${n})`;
  await cp(source, copy, { recursive: true, errorOnExist: true });
  openedFolders.add(copy);
  return copy;
});

ipcMain.handle(Channels.trashFolder, async (_event, folder: string): Promise<void> => {
  const target = inCharts(folder);
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
  const target = resolve(folder);
  if (!openedFolders.has(target)) throw new Error("that folder was not opened in this session");
  await writeFile(join(target, "chart.json"), text, "utf8");
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
