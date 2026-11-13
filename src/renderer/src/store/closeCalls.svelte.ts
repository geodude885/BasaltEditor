// Close calls as the editor shows them: all of doc.closeCalls but the hidden ones, unless they're
// turned off. Both are kept in this browser (or the desktop app's), not the chart: a hidden close call is
// remembered by both projectiles as they are, so it comes back if either changes.
import { SvelteSet } from "svelte/reactivity";
import { closeCallKey, type CloseCall } from "../model/closeCalls";
import { doc } from "./document.svelte";
import { remember, remembered } from "./remembered";

const SHOWN_KEY = "basalt-close-calls-shown";
const HIDDEN_KEY = "basalt-close-calls-meant";
/** The most kept; the oldest go first. */
const MOST_HIDDEN = 5000;

class CloseCalls {
  /** Whether close calls are looked for at all - off for charts that crowd structures on purpose. */
  shown = $state(remembered(SHOWN_KEY, true, text => text === "1"));
  readonly #hidden = new SvelteSet<string>(remembered<string[]>(HIDDEN_KEY, [], text => {
    const list: unknown = JSON.parse(text);
    return Array.isArray(list) ? list.filter((k): k is string => typeof k === "string") : undefined;
  }));

  /** The close calls to show: none when they're off, and none hidden. */
  readonly visible = $derived(this.shown ? doc.closeCalls.filter(call => !this.#hidden.has(closeCallKey(doc.chart, call))) : []);
  /** How many are hidden in this chart, as it is now. */
  readonly hiddenHere = $derived(doc.closeCalls.filter(call => this.#hidden.has(closeCallKey(doc.chart, call))).length);

  show(on: boolean): void {
    this.shown = on;
    remember(SHOWN_KEY, on ? "1" : "0");
  }

  /** Hides close calls: they're no longer shown while both projectiles stay as they are. */
  hide(calls: CloseCall[]): void {
    for (const call of calls) this.#hidden.add(closeCallKey(doc.chart, call));
    this.#keep();
  }

  /** Shows this chart's hidden close calls again. */
  showHiddenHere(): void {
    for (const call of doc.closeCalls) this.#hidden.delete(closeCallKey(doc.chart, call));
    this.#keep();
  }

  #keep(): void {
    remember(HIDDEN_KEY, JSON.stringify([...this.#hidden].slice(-MOST_HIDDEN)));
  }
}

export const closeCallState = new CloseCalls();
