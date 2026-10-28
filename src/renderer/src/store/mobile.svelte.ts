// The phone layout's own state: which sheet or drawer is open. Kept apart from the shared stores so the
// desktop layout carries none of it.
import type { Tab } from "./ui.svelte";

class MobileState {
  /** The menu sheet: files, playback settings, theme. */
  menu = $state(false);
  /** The settings tab open in the drawer, or null with the drawer shut. */
  drawer = $state<Tab | null>(null);

  /** Opens a tab in the drawer, or shuts the drawer if that tab is already open. */
  toggleDrawer(tab: Tab): void {
    this.drawer = this.drawer === tab ? null : tab;
    this.menu = false;
  }
}

export const mobile = new MobileState();
