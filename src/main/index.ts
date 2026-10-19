import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import updater from "electron-updater";
import { Channels, type OpenedFile, type OpenedFolder } from "../shared/api";

/** Chart folders this session opened - the only places saveChart may write. */
const openedFolders = new Set<string>();

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#15181c",
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
    const folder = join(root, "steamapps/common/RUMBLE/UserData/BossBattles/Charts");
    if (existsSync(folder)) return folder;
  }
  return undefined;
}

async function readAll(paths: string[], name: (path: string) => string): Promise<OpenedFile[]> {
  return Promise.all(paths.map(async path => ({ path: name(path), bytes: new Uint8Array(await readFile(path)) })));
}

ipcMain.handle(Channels.openFiles, async (event): Promise<OpenedFile[]> => {
  const window = BrowserWindow.fromWebContents(event.sender)!;
  const picked = await dialog.showOpenDialog(window, {
    title: "Open chart files",
    defaultPath: chartsFolder(),
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Charts, songs, covers and clips", extensions: ["json", "bbchart", "zip", "wav", "ogg", "mp3", "png", "jpg", "jpeg"] },
      { name: "All files", extensions: ["*"] },
    ],
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

void app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  // Installed copies update themselves from GitHub Releases.
  if (app.isPackaged) updater.autoUpdater.checkForUpdatesAndNotify().catch(e => console.error("update check failed:", e));
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
