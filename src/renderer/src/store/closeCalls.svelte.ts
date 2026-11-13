// Close calls as the editor shows them: all of doc.closeCalls but the ones marked as meant, unless they're
// turned off. Both are kept in this browser (or the desktop app's), not the chart: a meant close call is
// remembered by both projectiles as they are, so it comes back if either changes.
import { SvelteSet } from "svelte/reactivity";
import { closeCallKey, type CloseCall } from "../model/closeCalls";
import { doc } from "./document.svelte";
import { remember, remembered } from "./remembered";

const SHOWN_KEY = "basalt-close-calls-shown";
const MEANT_KEY = "basalt-close-calls-meant";
/** The most kept; the oldest go first. */
const MOST_MEANT = 5000;

class CloseCalls {
  /** Whether close calls are looked for at all - off for charts that crowd structures on purpose. */
  shown = $state(remembered(SHOWN_KEY, true, text => text === "1"));
  readonly #meant = new SvelteSet<string>(remembered<string[]>(MEANT_KEY, [], text => {
    const list: unknown = JSON.parse(text);
    return Array.isArray(list) ? list.filter((k): k is string => typeof k === "string") : undefined;
  }));

  /** The close calls to show: none when they're off, and none marked as meant. */
  readonly visible = $derived(this.shown ? doc.closeCalls.filter(call => !this.#meant.has(closeCallKey(doc.chart, call))) : []);
  /** How many are marked as meant in this chart, as it is now. */
  readonly meantHere = $derived(doc.closeCalls.filter(call => this.#meant.has(closeCallKey(doc.chart, call))).length);

  show(on: boolean): void {
    this.shown = on;
    remember(SHOWN_KEY, on ? "1" : "0");
  }

  /** Marks close calls as meant: they're no longer shown while both projectiles stay as they are. */
  markMeant(calls: CloseCall[]): void {
    for (const call of calls) this.#meant.add(closeCallKey(doc.chart, call));
    this.#keep();
  }

  /** Shows this chart's meant close calls again. */
  unmarkHere(): void {
    for (const call of doc.closeCalls) this.#meant.delete(closeCallKey(doc.chart, call));
    this.#keep();
  }

  #keep(): void {
    remember(MEANT_KEY, JSON.stringify([...this.#meant].slice(-MOST_MEANT)));
  }
}

export const closeCallState = new CloseCalls();
