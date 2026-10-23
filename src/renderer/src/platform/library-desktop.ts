// Your charts in the desktop app: the chart folders in the game's Charts folder, through the main
// process. An entry's id is its folder's path. Saving stays explicit (Ctrl S writes chart.json into the
// folder), so this source saves nothing itself; deleting moves the folder to the bin.
import type { EditorApi } from "../../../shared/api";
import { findCover } from "../io/files";
import { chartOfText, summaryOfText } from "../io/summary";
import * as Jsonc from "../model/jsonc";
import type { LibrarySource, StoredChart } from "../store/library.svelte";

const NO_BYTES = new Uint8Array();

export function desktopLibrary(api: Required<EditorApi>): LibrarySource {
  async function load(id: string): Promise<StoredChart | null> {
    const opened = await api.readFolder(id);
    const chart = opened.files.find(f => f.path.toLowerCase() === "chart.json");
    if (!chart) return null;
    const text = new TextDecoder().decode(chart.bytes);
    const files = new Map(opened.files.filter(f => f !== chart).map(f => [f.path, f.bytes]));
    return { summary: summaryOfText(opened.folder, text, files, Date.now()), text, files, folder: opened.folder };
  }

  return {
    autosaves: false,

    /** The chart folders - reading, of the images beside each chart.json, only the one that is its cover. */
    async list() {
      return Promise.all((await api.listCharts()).map(async f => {
        const files = new Map<string, Uint8Array>();
        const cover = findCover(new Map(f.images.map(name => [name, NO_BYTES])), chartOfText(f.text).cover);
        const bytes = cover ? await api.readCover(f.folder, cover).catch(() => null) : null;
        if (cover && bytes) files.set(cover, bytes);
        return summaryOfText(f.folder, f.text, files, f.modified);
      }));
    },

    load,

    async save() { /* Ctrl S saves into the folder */ },

    async remove(id) {
      await api.trashFolder(id);
    },

    /** Copies the folder beside itself, and names the copy's chart "… (copy)". */
    async duplicate(id) {
      // Not through load(), which would put the copy among the recent folders.
      const copy = await api.duplicateFolder(id), name = summaryOfText(id, copy.text, new Map(), 0).name;
      try { await api.saveChart(copy.folder, Jsonc.set(copy.text, "name", `${name} (copy)`)); } catch { /* keeps its name */ }
    },
  };
}
