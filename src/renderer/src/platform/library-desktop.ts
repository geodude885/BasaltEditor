// Your charts in the desktop app: the chart folders in the game's Charts folder, through the main
// process. An entry's id is its folder's path. Saving stays explicit (Ctrl S writes chart.json into the
// folder), so this source saves nothing itself; deleting moves the folder to the bin.
import type { EditorApi } from "../../../shared/api";
import { summaryOfText } from "../io/summary";
import * as Jsonc from "../model/jsonc";
import type { LibrarySource, StoredChart } from "../store/library.svelte";

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

    async list() {
      return (await api.listCharts()).map(f => summaryOfText(f.folder, f.text, new Map(f.images.map(i => [i.path, i.bytes])), f.modified));
    },

    load,

    async save() { /* Ctrl S saves into the folder */ },

    async remove(id) {
      await api.trashFolder(id);
    },

    /** Copies the folder beside itself, and names the copy's chart "… (copy)". */
    async duplicate(id) {
      const copy = await api.duplicateFolder(id);
      const stored = await load(copy);
      if (!stored) return;
      try { await api.saveChart(copy, Jsonc.set(stored.text, "name", `${stored.summary.name} (copy)`)); } catch { /* keeps its name */ }
    },
  };
}
