// The settings tabs, once: what each is called and which panel it shows. The desktop's tab bar
// (Panels.svelte) and the phone's rail and drawer (mobile/MobileDrawer.svelte) both draw from this,
// so a new tab is one entry here and one name in editor.svelte.ts's Tab - and TypeScript says if
// either is missing.
import type { Component } from "svelte";
import type { Tab } from "../../store/editor.svelte";
import ActorsPanel from "./ActorsPanel.svelte";
import ChartPanel from "./ChartPanel.svelte";
import HelpPanel from "./HelpPanel.svelte";
import LooksPanel from "./LooksPanel.svelte";
import PhasesPanel from "./PhasesPanel.svelte";
import ProblemsPanel from "./ProblemsPanel.svelte";
import TempoPanel from "./TempoPanel.svelte";

export type PanelTab = {
  /** On the desktop's tab bar. */
  label: string;
  /** On the phone's narrow rail. */
  short: string;
  panel: Component;
};

/** In the order they're shown. */
export const PANEL_TABS: Record<Tab, PanelTab> = {
  chart: { label: "Chart", short: "Chart", panel: ChartPanel },
  phases: { label: "Phases", short: "Phases", panel: PhasesPanel },
  looks: { label: "Looks", short: "Looks", panel: LooksPanel },
  tempo: { label: "Tempo", short: "Tempo", panel: TempoPanel },
  actors: { label: "Actors", short: "Actors", panel: ActorsPanel },
  problems: { label: "Problems", short: "Issues", panel: ProblemsPanel },
  help: { label: "Keys & help", short: "Help", panel: HelpPanel },
};

export const TAB_ORDER = Object.keys(PANEL_TABS) as Tab[];
