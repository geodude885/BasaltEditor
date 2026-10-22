import { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } from "electron";
import { cpSync, existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import updater from "electron-updater";
import { Channels, type FileKind, type OpenedFile, type OpenedFolder } from "../shared/api";

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
  const folder = resolve(picked.filePaths[0]);
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
  const files = await readAll(paths, path => path.slice(folder.length + 1).replace(/\\/g, "/"));
  return { folder, files };
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
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  // Installed copies update themselves from GitHub Releases.
  if (app.isPackaged) updater.autoUpdater.checkForUpdatesAndNotify().catch(e => console.error("update check failed:", e));
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
