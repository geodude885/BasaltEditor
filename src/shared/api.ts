// The one API the page gets from the desktop app, through the preload script. The page never touches
// Node or the file system itself.

export type OpenedFile = { path: string; bytes: Uint8Array };
export type OpenedFolder = { folder: string; files: OpenedFile[] };

export interface EditorApi {
  /** Picks chart files (chart.json, song, cover, clips, or a package). Empty when cancelled. */
  openFiles(): Promise<OpenedFile[]>;
  /** Picks a chart folder and reads chart.json, the files beside it and clips/. Null when cancelled. */
  openFolder(): Promise<OpenedFolder | null>;
  /** Writes chart.json into a folder this session opened. */
  saveChart(folder: string, text: string): Promise<void>;
  /** Asks where to save a file and writes it. The path it went to, or null when cancelled. */
  saveFile(suggestedName: string, bytes: Uint8Array): Promise<string | null>;
}

export const Channels = {
  openFiles: "editor:open-files",
  openFolder: "editor:open-folder",
  saveChart: "editor:save-chart",
  saveFile: "editor:save-file",
} as const;
