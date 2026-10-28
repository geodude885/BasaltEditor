// How the chart is shown: which editor, where the timeline looks and how its rows are laid out, the
// look preview, what colours projectiles, how many columns the highway has. Choices worth keeping are remembered here, not in the chart.
import { SvelteSet } from "svelte/reactivity";
import { HIGHWAY_COLUMNS_RANGE, PROJECTILE_COLUMNS } from "../model/columns";
import { SHOT_COLOURINGS, type ShotColouring } from "../views/shotColours";
import { MOST_EXTRA_TIMELINE_HEIGHT_PIXELS, type TimelineRow } from "../views/timeline/geometry";
import { remember, remembered } from "./remembered";

/** The editors the timeline's place can show, in either layout. */
export type MainView = "timeline" | "highway";

const COLLAPSED_ROWS_KEY = "basalt-collapsed-timeline-rows";
const EXTRA_TIMELINE_HEIGHT_KEY = "basalt-extra-timeline-height";
const LOOK_PREVIEW_KEY = "basalt-look-preview";
const SHOT_COLOURING_KEY = "basalt-shot-colouring";
const HIGHWAY_COLUMNS_KEY = "basalt-highway-columns";

const highwayColumnCount = (n: number): number => Math.min(HIGHWAY_COLUMNS_RANGE[1], Math.max(HIGHWAY_COLUMNS_RANGE[0], Math.round(n)));

class Display {
  /** Which editor is showing: the timeline, or the highway. */
  mainView = $state<MainView>("timeline");
  /** The timeline's view: its left edge in seconds, and pixels a second. */
  timeline = $state({ t0: -1, pps: 60 });
  timelineWidth = $state(800);
  readonly collapsedTimelineRows = new SvelteSet<TimelineRow>(remembered<TimelineRow[]>(COLLAPSED_ROWS_KEY, [], text => {
    const rows: unknown = JSON.parse(text);
    return Array.isArray(rows) ? rows : undefined;
  }));
  extraTimelineHeightPixels = $state(remembered(EXTRA_TIMELINE_HEIGHT_KEY, 0, text => {
    const pixels = parseFloat(text);
    return pixels >= 0 ? Math.min(pixels, MOST_EXTRA_TIMELINE_HEIGHT_PIXELS) : undefined;
  }));
  /** The look preview window: the Stage look on a painted arena. */
  lookPreview = $state(remembered(LOOK_PREVIEW_KEY, false, text => text === "1"));
  /** What colours projectiles in the lane, timeline and highway. */
  shotColouring = $state(remembered<ShotColouring>(SHOT_COLOURING_KEY, "plain",
    text => SHOT_COLOURINGS.some(([c]) => c === text) ? text as ShotColouring : undefined));
  /** How many columns the highway has, and so how many pads and keys record. */
  highwayColumns = $state(remembered(HIGHWAY_COLUMNS_KEY, PROJECTILE_COLUMNS, text => {
    const n = parseInt(text, 10);
    return Number.isFinite(n) ? highwayColumnCount(n) : undefined;
  }));

  toggleLookPreview(): void {
    this.lookPreview = !this.lookPreview;
    remember(LOOK_PREVIEW_KEY, this.lookPreview ? "1" : "0");
  }

  colourShotsBy(colouring: ShotColouring): void {
    this.shotColouring = colouring;
    remember(SHOT_COLOURING_KEY, colouring);
  }

  setHighwayColumns(n: number): void {
    if (!Number.isFinite(n)) return;
    this.highwayColumns = highwayColumnCount(n);
    remember(HIGHWAY_COLUMNS_KEY, String(this.highwayColumns));
  }

  rememberTimelineLayout(): void {
    remember(COLLAPSED_ROWS_KEY, JSON.stringify([...this.collapsedTimelineRows]));
    remember(EXTRA_TIMELINE_HEIGHT_KEY, String(this.extraTimelineHeightPixels));
  }
}

export const display = new Display();
