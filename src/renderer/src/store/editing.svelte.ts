// What is being edited: the selected events, phase and look, and how presses select and snap.
import { SvelteSet } from "svelte/reactivity";

class Editing {
  /** Indices into chart.events. */
  readonly selection = new SvelteSet<number>();
  selectedPhase = $state(-1);
  selectedLookCue = $state(-1);
  /** Presses add to the selection, as Shift does - for touch screens, which have no Shift. */
  multiSelect = $state(false);
  /** Select mode: a drag on empty space draws a selection box at once, instead of panning or scrubbing. */
  selectMode = $state(false);
  /** Snap in beats; 0 is off. */
  snap = $state(0.5);

  setSelection(indices: Iterable<number>): void {
    this.selection.clear();
    for (const i of indices) this.selection.add(i);
  }
}

export const editing = new Editing();
