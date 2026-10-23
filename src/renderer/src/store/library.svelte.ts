// Your charts: every chart worked on, with its song, cover and clips, to switch between without
// picking files again. Where they are kept is a LibrarySource: the browser's storage on the web
// (platform/library-web.ts), where changes save themselves a moment after they are made - or, in the
// desktop app, the game's Charts folder (platform/library-desktop.ts), where saving stays Ctrl S.
import { summaryOf, type ChartSummary } from "../io/summary";
import * as Jsonc from "../model/jsonc";
import { toast } from "./actions";
import { doc } from "./document.svelte";
import { editor } from "./editor.svelte";
import { mayReplaceChart, openStored } from "./files";

export type { ChartSummary };

/** A chart as a source keeps it; `folder` is where it lives on disk, when it does. */
export type StoredChart = { summary: ChartSummary; text: string; files: Map<string, Uint8Array>; folder?: string };

/** Where charts are kept. Saving sends only the files that changed, and the paths of those gone. */
export interface LibrarySource {
  /** Keeps every change as it is made (the default). False where saving stays explicit. */
  autosaves?: boolean;
  list(): Promise<ChartSummary[]>;
  load(id: string): Promise<StoredChart | null>;
  save(summary: ChartSummary, text: string, changed: [string, Uint8Array][], removed: string[]): Promise<void>;
  remove(id: string): Promise<void>;
  /** Copies a chart its own way; without it, the library loads and saves a copy. */
  duplicate?(id: string): Promise<void>;
}

const CURRENT_KEY = "basalt-library-current";
const SAVE_AFTER_MS = 800;

class Library {
  /** Whether there is a library here: the web, or the desktop app with the game installed. */
  available = $state(false);
  /** Charts save themselves as they change (the web), rather than with Ctrl S (the desktop). */
  autosaves = $state(true);
  /** The library screen is open. */
  visible = $state(false);
  entries = $state.raw<ChartSummary[]>([]);
  #source: LibrarySource | null = null;
  /** The files last saved for the current chart, by path, to save only what changed. */
  #saved = new Map<string, Uint8Array>();
  #created = Date.now();
  #timer = 0;

  /** Starts keeping charts in a source - and, where it saves as you go, picks up last time's chart. main.ts calls it. */
  start(source: LibrarySource): void {
    this.#source = source;
    this.available = true;
    this.autosaves = source.autosaves ?? true;
    if (!this.autosaves) return;
    $effect.root(() => {
      $effect(() => {
        void doc.text; void editor.files; void editor.libraryAdd;
        clearTimeout(this.#timer);
        this.#timer = window.setTimeout(() => void this.#sync(), SAVE_AFTER_MS);
      });
    });
    void this.#restore();
  }

  /** Saves the open chart now, if a save is waiting - before another chart replaces it. False if it couldn't (and said so). */
  async flush(): Promise<boolean> {
    clearTimeout(this.#timer);
    return this.#sync();
  }

  show(): void {
    this.visible = true;
    void this.refresh();
  }

  /** Whether an entry is the chart open now. */
  isCurrent(id: string): boolean {
    return id === editor.libraryId || id === editor.folder;
  }

  async refresh(): Promise<void> {
    if (!this.#source) return;
    try { this.entries = (await this.#source.list()).sort((a, b) => b.updated - a.updated); }
    catch (e) { toast(`Could not read your charts: ${(e as Error).message}`); }
  }

  async open(id: string): Promise<void> {
    if (this.isCurrent(id)) { this.visible = false; return; }
    if (!await mayReplaceChart()) return;
    try {
      const stored = await this.#source?.load(id);
      if (!stored) { toast("That chart is gone"); await this.refresh(); return; }
      await openStored(stored.text, stored.summary.name, stored.files, stored.folder ?? null);
      this.#become(stored);
      this.visible = false;
      toast(`Opened ${stored.summary.name}`);
    } catch (e) {
      toast(`Could not open that chart: ${(e as Error).message}`);
    }
  }

  async duplicate(id: string): Promise<void> {
    const source = this.#source;
    if (!source) return;
    try {
      if (source.duplicate) await source.duplicate(id);
      else {
        const stored = await source.load(id);
        if (!stored) return;
        const name = `${stored.summary.name} (copy)`, now = Date.now();
        let text = stored.text;
        try { text = Jsonc.set(text, "name", name); } catch { /* keep the text as it was */ }
        await source.save({ ...stored.summary, id: crypto.randomUUID(), name, created: now, updated: now }, text, [...stored.files], []);
      }
    } catch (e) {
      toast(`Could not copy that chart: ${(e as Error).message}`);
    }
    await this.refresh();
  }

  async remove(id: string): Promise<void> {
    try { await this.#source?.remove(id); }
    catch (e) { toast(`Could not delete that chart: ${(e as Error).message}`); return; }
    if (this.isCurrent(id)) {
      editor.libraryId = null;
      // Its folder is gone: Save asks where to save again.
      if (editor.folder === id) editor.folder = null;
      this.#remember(null);
    }
    await this.refresh();
  }

  #become(stored: StoredChart): void {
    editor.libraryId = stored.summary.id;
    editor.libraryAdd = false;
    this.#created = stored.summary.created;
    this.#saved = new Map(stored.files);
    if (this.autosaves) this.#remember(stored.summary.id);
  }

  /** Last time's chart: its text from the draft (which may be newer), its files from the library. */
  async #restore(): Promise<void> {
    let id: string | null = null;
    try { id = localStorage.getItem(CURRENT_KEY); } catch { /* none */ }
    if (!id || !this.#source) return;
    const stored = await this.#source.load(id).catch(() => null);
    if (!stored) return;
    if (stored.files.size) await openStored(doc.text, doc.name, stored.files);
    this.#become(stored);
  }

  /**
   * Saves the open chart, where the source saves as you go: a new entry if it isn't in the library yet
   * but should be. False only when saving failed.
   */
  async #sync(): Promise<boolean> {
    const source = this.#source;
    if (!source || !this.autosaves) return true;
    let id = editor.libraryId;
    if (!id) {
      // Opened or started charts join straight away; the example only once it's been changed.
      if (!editor.libraryAdd && !doc.dirty) return true;
      id = crypto.randomUUID();
      editor.libraryId = id;
      editor.libraryAdd = false;
      this.#created = Date.now();
      this.#saved = new Map();
      this.#remember(id);
      void navigator.storage?.persist?.();
    }
    const files = editor.files;
    const changed = [...files].filter(([path, bytes]) => this.#saved.get(path) !== bytes);
    const removed = [...this.#saved.keys()].filter(path => !files.has(path));
    try {
      await source.save(summaryOf(id, doc.chart, files, this.#created, Date.now()), doc.text, changed, removed);
      for (const [path, bytes] of changed) this.#saved.set(path, bytes);
      for (const path of removed) this.#saved.delete(path);
      if (this.visible) await this.refresh();
      return true;
    } catch (e) {
      toast(`Could not keep this chart in your charts: ${(e as Error).message}`);
      return false;
    }
  }

  #remember(id: string | null): void {
    try { if (id) localStorage.setItem(CURRENT_KEY, id); else localStorage.removeItem(CURRENT_KEY); } catch { /* not remembered */ }
  }
}

export const library = new Library();
