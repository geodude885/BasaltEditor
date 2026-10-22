// The phone layout's own state: which sheet or drawer is open, and which editor fills the screen.
// Kept apart from editor.svelte.ts so the desktop layout carries none of it.
import { DEFAULT_HIGHWAY_PPS } from "../views/highway/geometry";
import type { Tab } from "./editor.svelte";

/** The editors the phone layout can show. More (say, one for looks) can join this list. */
export type MobileView = "timeline" | "highway";

class MobileState {
  /** The menu sheet: files, playback settings, theme. */
  menu = $state(false);
  /** The settings tab open in the drawer, or null with the drawer shut. */
  drawer = $state<Tab | null>(null);
  view = $state<MobileView>("timeline");
  /** How stretched the highway is: pixels a second. */
  highwayPps = $state(DEFAULT_HIGHWAY_PPS);
  /** The A-B loop playing goes round, in chart time, or null. */
  loop = $state<readonly [number, number] | null>(null);
  /** A loop's first point, once set and until the second is. */
  loopStart = $state<number | null>(null);
  /** Where playing last started, to jump back to. */
  playFrom = $state(0);
  /** Start a bar early when playing from the highway, to hear the music lead in. */
  preroll = $state(false);

  /** Opens a tab in the drawer, or shuts the drawer if that tab is already open. */
  toggleDrawer(tab: Tab): void {
    this.drawer = this.drawer === tab ? null : tab;
    this.menu = false;
  }
}

export const mobile = new MobileState();
