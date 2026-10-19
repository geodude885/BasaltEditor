// The open chart. Its text is the source of truth: an edit mutates the parsed chart, then writes the
// keys it touched back into the text, so comments and anything the editor does not show survive.
// Undo keeps texts, not objects.
import { evTime } from "../model/chart";
import * as Jsonc from "../model/jsonc";
import { Tempo } from "../model/tempo";
import type { LoadedChart } from "../model/types";

const DRAFT_KEY = "basalt-draft";
const MAX_UNDO = 200;

export function parseChart(text: string): LoadedChart {
  const chart = Jsonc.parse(text);
  if (!chart || typeof chart !== "object" || Array.isArray(chart)) throw new Error("a chart is a JSON object");
  const loaded = chart as LoadedChart;
  loaded.events ??= [];
  return loaded;
}

class ChartDocument {
  text = $state("");
  chart = $state<LoadedChart>({ events: [] });
  /** The file it came from, for messages. */
  name = $state("chart.json");
  /** The text as last opened or saved: the chart has unsaved changes when they differ. */
  saved = $state("");
  #undo = $state.raw<string[]>([]);
  #redo = $state.raw<string[]>([]);

  readonly tempo = $derived(new Tempo(this.chart.bpm));
  readonly dirty = $derived(this.text !== this.saved);
  get canUndo(): boolean { return this.#undo.length > 0; }
  get canRedo(): boolean { return this.#redo.length > 0; }

  load(text: string, name: string): void {
    this.chart = parseChart(text);
    this.text = this.saved = text;
    this.name = name;
    this.#undo = [];
    this.#redo = [];
    this.#draft();
  }

  /**
   * Makes a change undoable: `mutate` edits the chart, then each of `keys` - and any keys `mutate`
   * returns - is written back into the text.
   */
  change(keys: string[], mutate: () => void | string[]): void {
    const before = this.text;
    // TypeScript lets `() => list.push(x)` stand for `() => void`, so check what came back.
    const more = mutate();
    this.#record(before);
    this.#write([...new Set([...keys, ...(Array.isArray(more) ? more : [])])]);
  }

  /** Records a change already made live, such as a drag; `before` is the text from before it began. */
  commit(before: string, keys: string[]): void {
    this.#record(before);
    this.#write(keys);
  }

  undo(): boolean { return this.#step(true); }
  redo(): boolean { return this.#step(false); }

  markSaved(): void { this.saved = this.text; }

  /** The last draft this app kept, if it still parses. */
  static restoreDraft(): { text: string; name: string } | null {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null");
      if (d?.text) { parseChart(d.text); return { text: d.text, name: d.name }; }
    } catch { /* none, or broken */ }
    return null;
  }

  #record(before: string): void {
    this.#undo = [...this.#undo.slice(-(MAX_UNDO - 1)), before];
    this.#redo = [];
  }

  #write(keys: string[]): void {
    let text = this.text;
    for (const key of keys) {
      if (key === "events") this.chart.events.sort((a, b) => evTime(a, this.tempo) - evTime(b, this.tempo));
      text = Jsonc.set(text, key, $state.snapshot(this.chart[key as keyof LoadedChart]));
    }
    this.text = text;
    this.#draft();
  }

  #step(back: boolean): boolean {
    const from = back ? this.#undo : this.#redo;
    const text = from.at(-1);
    if (text == null) return false;
    if (back) { this.#undo = from.slice(0, -1); this.#redo = [...this.#redo, this.text]; }
    else { this.#redo = from.slice(0, -1); this.#undo = [...this.#undo, this.text]; }
    this.text = text;
    this.chart = parseChart(text);
    this.#draft();
    return true;
  }

  #draft(): void {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ text: this.text, name: this.name })); } catch { /* no storage: fine */ }
  }
}

export const restoreDraft = ChartDocument.restoreDraft;
export const doc = new ChartDocument();
