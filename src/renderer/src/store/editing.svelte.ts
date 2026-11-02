// What is being edited: the selected events, phase and look, how presses select and snap, and what new
// projectiles in a column are like.
import { SvelteSet } from "svelte/reactivity";
import type { ProjectileTemplate } from "../model/columns";
import { STRUCTURES } from "../model/constants";
import { remember, remembered } from "./remembered";

const NEW_PROJECTILE_KEY = "basalt-new-projectile";

// Kept as JSON; anything that doesn't look like a projectile is forgotten. One kept before chart format 3
// may name who throws it and aim at "player": neither can be written into a chart now.
const readTemplate = (text: string): ProjectileTemplate | null | undefined => {
  const p: unknown = JSON.parse(text);
  if (p === null) return null;
  const t = p as ProjectileTemplate & { by?: string };
  if (!t || typeof t !== "object" || !STRUCTURES.includes(t.structure) || !t.from || typeof t.from !== "object") return undefined;
  delete t.by;
  if (typeof t.to !== "object") delete t.to;
  return t;
};

class Editing {
  /** Indices into chart.events. */
  readonly selection = new SvelteSet<number>();
  /** Indices into chart.shaders: looks are selected alongside events. */
  readonly selectedLooks = new SvelteSet<number>();
  selectedPhase = $state(-1);
  /** Presses add to the selection, as Shift does - for touch screens, which have no Shift. */
  multiSelect = $state(false);
  /** Select mode: a drag on empty space draws a selection box at once, instead of panning or scrubbing. */
  selectMode = $state(false);
  /** Snap in beats; 0 is off. */
  snap = $state(0.5);
  /**
   * What a projectile added in a column is like - by a recording pad or key, a tap on the highway or the
   * timeline's projectile row - or null for the default, a disc straight down the lane. Kept between charts.
   */
  newProjectile = $state<ProjectileTemplate | null>(remembered(NEW_PROJECTILE_KEY, null, readTemplate));

  /** The one look selected, for what edits a single look; -1 with none, or several. */
  get selectedLookCue(): number { return this.selectedLooks.size === 1 ? [...this.selectedLooks][0] : -1; }
  get selectedCount(): number { return this.selection.size + this.selectedLooks.size; }
  get hasSelection(): boolean { return this.selectedCount > 0; }

  clearSelection(): void {
    this.selection.clear();
    this.selectedLooks.clear();
  }

  setLookSelection(indices: Iterable<number>): void {
    this.selectedLooks.clear();
    for (const i of indices) this.selectedLooks.add(i);
  }

  placeLike(template: ProjectileTemplate | null): void {
    this.newProjectile = template;
    remember(NEW_PROJECTILE_KEY, JSON.stringify(template));
  }

  setSelection(indices: Iterable<number>): void {
    this.selection.clear();
    for (const i of indices) this.selection.add(i);
  }
}

export const editing = new Editing();
