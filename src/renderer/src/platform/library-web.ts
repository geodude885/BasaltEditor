// Your charts in the browser's storage (IndexedDB): one record per chart - its summary and text - and
// its files apart, keyed by chart and path, so listing charts never reads a song.
import type { ChartSummary, LibrarySource, StoredChart } from "../store/library.svelte";
import { Idb } from "./idb";

type Entry = { summary: ChartSummary; text: string; paths: string[] };

const db = new Idb("basalt-library", 1, { charts: {}, files: {} });
const fileKey = (id: string, path: string) => `${id}\n${path}`;
/** Every file key of one chart: "id\n" up to just past it. */
const filesOf = (id: string) => IDBKeyRange.bound(`${id}\n`, `${id}\n\uffff`);

export const webLibrary: LibrarySource = {
  async list() {
    return (await db.all<Entry>("charts")).map(r => r.summary);
  },

  async load(id): Promise<StoredChart | null> {
    const record = await db.get<Entry>("charts", id);
    if (!record) return null;
    const files = new Map<string, Uint8Array>();
    for (const path of record.paths) {
      const bytes = await db.get<Uint8Array>("files", fileKey(id, path));
      if (bytes) files.set(path, bytes);
    }
    return { summary: record.summary, text: record.text, files };
  },

  // Each in one transaction, so a chart is never left with half its files - and saves made close
  // together run one after the other, each reading the paths the one before wrote.
  async save(summary, text, changed, removed) {
    const id = summary.id;
    await db.transaction(["charts", "files"], "readwrite", tx => {
      const charts = tx.objectStore("charts"), files = tx.objectStore("files");
      for (const [path, bytes] of changed) files.put(bytes, fileKey(id, path));
      for (const path of removed) files.delete(fileKey(id, path));
      const before = charts.get(id);
      before.onsuccess = () => {
        const paths = new Set((before.result as Entry | undefined)?.paths ?? []);
        for (const [path] of changed) paths.add(path);
        for (const path of removed) paths.delete(path);
        charts.put({ summary, text, paths: [...paths] } satisfies Entry, id);
      };
    });
  },

  async remove(id) {
    await db.transaction(["charts", "files"], "readwrite", tx => {
      tx.objectStore("files").delete(filesOf(id));
      tx.objectStore("charts").delete(id);
    });
  },
};
