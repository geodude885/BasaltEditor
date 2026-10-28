// The editor's own interface, shared by both layouts: the settings tab, quick actions, toasts and
// the questions it asks. What only one layout has lives with it (store/mobile.svelte.ts).

export type Tab = "chart" | "phases" | "looks" | "tempo" | "actors" | "problems" | "help";

class Ui {
  tab = $state<Tab>("chart");
  /** Counts requests to bring the settings tab into view (revealTab); each layout answers them its own way. */
  tabRevealed = $state(0);
  /** Quick actions for the selection, from a long press on it: where the finger was, or null when shut. */
  quickActions = $state<{ x: number; y: number } | null>(null);
  toast = $state<{ text: string; id: number } | null>(null);
  /** The Chart tab is asking about unsaved changes before starting a new chart. */
  confirmNew = $state(false);
  /** Shows chart.json as text to copy by hand, when the clipboard refuses. */
  showText = $state(false);
  /** The Tempo tab's taps, for tapping out a BPM. */
  tapTimes = $state.raw<number[]>([]);

  /**
   * Shows a settings tab, wherever the layout keeps them: the desktop's tab bar is always there, so
   * it just switches; the phone opens its drawer on it (MobileApp watches `tabRevealed`). Shared code
   * asks for a tab this way rather than reaching into either layout.
   */
  revealTab(tab: Tab): void {
    this.tab = tab;
    this.tabRevealed++;
  }
}

export const ui = new Ui();
