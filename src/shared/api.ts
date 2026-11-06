// The one API the page gets from the desktop app, through the preload script. The page never touches
// Node or the file system itself.

export type OpenedFile = {
  path: string;
  bytes: Uint8Array;
  /** The chart folder of the Charts folder it is the chart.json of, when picked on its own (openFiles). */
  folder?: string;
};
export type OpenedFolder = { folder: string; files: OpenedFile[] };
/** What a file picker is for: just a song, just a cover, a video to make looks from - or, left out, any of the chart's files. */
export type FileKind = "song" | "cover" | "video";
/** A chart folder in the game's Charts folder, for "Your charts": chart.json's text and the names of the images beside it. */
export type ChartFolder = { folder: string; text: string; modified: number; images: string[] };
/** A chart folder's copy: where it is, and its chart.json's text. */
export type DuplicatedFolder = { folder: string; text: string };
/** What to do with unsaved changes before opening another chart. */
export type UnsavedChoice = "save" | "discard" | "cancel";
/** What to do with a chart that has no folder when a chart folder already holds one like it. */
export type SameChartChoice = "there" | "new" | "cancel";

/** A shader pack RumbleReShaded has in the running game; `player` is the player's own value of a slider. */
export type LiveLinkPack = {
  id: string;
  name: string;
  parameters: { property: string; label: string; min: number; max: number; default: number; player: number }[];
};
/** What the game said when linked: its packs, and what its live link can do beyond looks ("globals"). */
export type LiveLinkGreeting = { packs: LiveLinkPack[]; features: string[] };
/** A pack's look to show in the game: sliders left out are the player's. */
export type LiveLinkLook = { pack: string; on: boolean; values: Record<string, number> };
/**
 * What changed for the live link: looks to show, packs to hand back, and shader globals to set as a mod would during
 * play ("basalt.beat"), null putting one back to 0.
 */
export type LiveLinkUpdate = { looks: LiveLinkLook[]; released: string[]; globals?: Record<string, number | null> };

export interface EditorApi {
  /** Picks chart files (chart.json, song, cover, clips, or a package) - or one song or cover. Empty when cancelled. */
  openFiles(kind?: FileKind): Promise<OpenedFile[]>;
  /** Picks a chart folder and reads chart.json, the files beside it and clips/. Null when cancelled. */
  openFolder(): Promise<OpenedFolder | null>;
  /** Writes chart.json into a folder this session opened. */
  saveChart(folder: string, text: string): Promise<void>;
  /** Asks where to save a file and writes it. The path it went to, or null when cancelled. */
  saveFile(suggestedName: string, bytes: Uint8Array): Promise<string | null>;
  /** Puts the window frame and dialogs in the page's theme. */
  setTheme(theme: "system" | "dark" | "light"): Promise<void>;

  // The rest only the desktop app has: "Your charts" over the game's Charts folder, and recent folders.

  /** The game's Charts folder, or null when RUMBLE isn't installed anywhere usual. */
  chartsFolder?(): Promise<string | null>;
  /** Every chart folder in the Charts folder. */
  listCharts?(): Promise<ChartFolder[]>;
  /** One image beside chart.json in a chart folder of the Charts folder, for its card; null when it is too big to show. */
  readCover?(folder: string, name: string): Promise<Uint8Array | null>;
  /** Reads a chart folder as Open folder does, without asking: one in the Charts folder, or opened before. */
  readFolder?(folder: string): Promise<OpenedFolder>;
  /** Copies a chart folder in the Charts folder beside itself. */
  duplicateFolder?(folder: string): Promise<DuplicatedFolder>;
  /** Makes a chart folder in the Charts folder, named after the chart, with these files (chart.json among them); its path. */
  createChartFolder?(chartName: string, files: OpenedFile[], difficulty?: string): Promise<string>;
  /** Renames a chart folder in the Charts folder after its chart's name and difficulty (shared/folders.ts); its path now. */
  renameChartFolder?(folder: string, chartName: string, difficulty?: string): Promise<string>;
  /** Writes a chart's files (beside chart.json, or in clips/) into a folder this session opened. */
  saveFiles?(folder: string, files: OpenedFile[]): Promise<void>;
  /** Moves a chart folder in the Charts folder to the bin. */
  trashFolder?(folder: string): Promise<void>;
  /** The chart folders opened lately, newest first. */
  recentFolders?(): Promise<string[]>;
  /** Asks whether to save the open chart's changes before another opens. */
  askUnsaved?(name: string): Promise<UnsavedChoice>;
  /** Asks where to save a chart with no folder, when this folder already holds one of its name and difficulty. */
  askSameChart?(name: string, folderName: string): Promise<SameChartChoice>;
  /** Connects to RumbleReShaded in the running game (its Live link setting), and says which packs it has. Rejects if it can't. */
  connectLiveLink?(): Promise<LiveLinkGreeting>;
  /** Shows looks in the game, over the live link. */
  sendLiveLink?(update: LiveLinkUpdate): Promise<void>;
  /** Ends the live link: the game hands every pack back to the player. */
  disconnectLiveLink?(): Promise<void>;
  /** Calls back when the live link drops by itself - the game closed, say. */
  onLiveLinkClosed?(closed: () => void): void;
}

/** The API as the desktop app's preload gives it: every call, the desktop's own included. */
export type DesktopApi = Required<EditorApi>;

/** Whether this is the desktop app's API, with "Your charts" over the Charts folder and recent folders. */
export const isDesktop = (api: EditorApi): api is DesktopApi => typeof api.listCharts === "function";

export const Channels = {
  openFiles: "editor:open-files",
  openFolder: "editor:open-folder",
  saveChart: "editor:save-chart",
  saveFile: "editor:save-file",
  setTheme: "editor:set-theme",
  chartsFolder: "editor:charts-folder",
  listCharts: "editor:list-charts",
  readCover: "editor:read-cover",
  readFolder: "editor:read-folder",
  duplicateFolder: "editor:duplicate-folder",
  createChartFolder: "editor:create-chart-folder",
  saveFiles: "editor:save-files",
  trashFolder: "editor:trash-folder",
  renameChartFolder: "editor:rename-chart-folder",
  recentFolders: "editor:recent-folders",
  askUnsaved: "editor:ask-unsaved",
  askSameChart: "editor:ask-same-chart",
  connectLiveLink: "editor:connect-live-link",
  sendLiveLink: "editor:send-live-link",
  disconnectLiveLink: "editor:disconnect-live-link",
  liveLinkClosed: "editor:live-link-closed",
} as const;
