// Your charts: every chart worked on, kept with its song, cover and clips so you can switch between
// them without picking files again. Where they are kept is a LibrarySource - the browser's storage
// on the web (platform/library-web.ts); the desktop app could list its Charts folder through the
// same interface (docs/plans/web-merge.md). Changes save themselves a moment after they are
// made.
import { findCover } from "../io/files";
import * as Jsonc from "../model/jsonc";
import { doc } from "./document.svelte";
import { editor } from "./editor.svelte";
import { openStored } from "./files";
import { toast } from "./actions";

export type ChartSummary = {
  id: string;
  name: string;
  author?: string;
  difficulty?: string;
  projectiles: number;
  song?: string;
  cover?: Uint8Array;
  created: number;
  updated: number;
};

export type StoredChart = { summary: ChartSummary; text: string; files: Map<string, Uint8Array> };

/** Where charts are kept. Saving sends only the files that changed, and the paths of those gone. */
export interface LibrarySource {
  list(): Promise<ChartSummary[]>;
  load(id: string): Promise<StoredChart | null>;
  save(summary: ChartSummary, text: string, changed: [string, Uint8Array][], removed: string[]): Promise<void>;
  remove(id: string): Promise<void>;
}

const CURRENT_KEY = "basalt-library-current";
const SAVE_AFTER_MS = 800;

function summarise(id: string, created: number): ChartSummary {
  const c = doc.chart, coverKey = findCover(editor.files, c.cover);
  return {
    id, created, updated: Date.now(),
    name: c.name || "Untitled", author: c.author || undefined, difficulty: c.difficulty || undefined,
    projectiles: c.events.filter(e => e.projectile).length,
    song: c.music?.file || undefined,
    cover: coverKey ? editor.files.get(coverKey) : undefined,
  };
}

class Library {
  /** Whether there is a library here (the web, for now). */
  available = $state(false);
  /** The library screen is open. */
  visible = $state(false);
  entries = $state.raw<ChartSummary[]>([]);
  #source: LibrarySource | null = null;
  /** The files last saved for the current chart, by path, to save only what changed. */
  #saved = new Map<string, Uint8Array>();
  #created = Date.now();
  #timer = 0;

  /** Starts keeping charts in a source, and picks up the chart that was open last time. main.ts calls it. */
  start(source: LibrarySource): void {
    this.#source = source;
    this.available = true;
    $effect.root(() => {
      $effect(() => {
        void doc.text; void editor.files; void editor.libraryAdd;
        clearTimeout(this.#timer);
        this.#timer = window.setTimeout(() => void this.#sync(), SAVE_AFTER_MS);
      });
    });
    void this.#restore();
  }

  show(): void {
    this.visible = true;
    void this.refresh();
  }

  async refresh(): Promise<void> {
    if (!this.#source) return;
    try { this.entries = (await this.#source.list()).sort((a, b) => b.updated - a.updated); }
    catch (e) { toast(`Could not read your charts: ${(e as Error).message}`); }
  }

  async open(id: string): Promise<void> {
    if (id === editor.libraryId) { this.visible = false; return; }
    await this.#sync();
    const stored = await this.#source?.load(id);
    if (!stored) { toast("That chart is gone"); await this.refresh(); return; }
    await openStored(stored.text, stored.summary.name, stored.files);
    this.#become(stored);
    this.visible = false;
    toast(`Opened ${stored.summary.name}`);
  }

  async duplicate(id: string): Promise<void> {
    const stored = await this.#source?.load(id);
    if (!stored || !this.#source) return;
    const name = `${stored.summary.name} (copy)`, now = Date.now();
    let text = stored.text;
    try { text = Jsonc.set(text, "name", name); } catch { /* keep the text as it was */ }
    await this.#source.save({ ...stored.summary, id: crypto.randomUUID(), name, created: now, updated: now }, text, [...stored.files], []);
    await this.refresh();
  }

  async remove(id: string): Promise<void> {
    await this.#source?.remove(id);
    if (id === editor.libraryId) { editor.libraryId = null; this.#remember(null); }
    await this.refresh();
  }

  #become(stored: StoredChart): void {
    editor.libraryId = stored.summary.id;
    editor.libraryAdd = false;
    this.#created = stored.summary.created;
    this.#saved = new Map(stored.files);
    this.#remember(stored.summary.id);
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

  /** Saves the open chart: a new entry if it isn't in the library yet but should be. */
  async #sync(): Promise<void> {
    const source = this.#source;
    if (!source) return;
    let id = editor.libraryId;
    if (!id) {
      // Opened or started charts join straight away; the example only once it's been changed.
      if (!editor.libraryAdd && !doc.dirty) return;
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
      await source.save(summarise(id, this.#created), doc.text, changed, removed);
      for (const [path, bytes] of changed) this.#saved.set(path, bytes);
      for (const path of removed) this.#saved.delete(path);
      if (this.visible) await this.refresh();
    } catch (e) {
      toast(`Could not keep this chart in your charts: ${(e as Error).message}`);
    }
  }

  #remember(id: string | null): void {
    try { if (id) localStorage.setItem(CURRENT_KEY, id); else localStorage.removeItem(CURRENT_KEY); } catch { /* not remembered */ }
  }
}

export const library = new Library();
