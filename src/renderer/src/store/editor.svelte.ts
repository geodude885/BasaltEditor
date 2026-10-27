// What the editor is doing, as opposed to what the chart says: selection, playhead, view, the files
// opened beside the chart.
import { SvelteSet } from "svelte/reactivity";
import type { Peaks } from "../audio/peaks";
import { fileProblems, type ClipSpan } from "../io/files";
import { timedLookCues } from "../model/looks";
import { problems } from "../model/problems";
import { SHOT_COLOURINGS, type ShotColouring } from "../views/shotColours";
import { MOST_EXTRA_TIMELINE_HEIGHT_PIXELS, type TimelineRow } from "../views/timeline/geometry";
import { doc } from "./document.svelte";

export type Tab = "chart" | "phases" | "looks" | "tempo" | "actors" | "problems" | "help";
/** The editors the timeline's place can show, in either layout. */
export type MainView = "timeline" | "highway";
export type Song = { name: string; url: string; buffer: AudioBuffer | null; peaks: Peaks | null };

const VOLUME_KEY = "basalt-volume";
const COLLAPSED_ROWS_KEY = "basalt-collapsed-timeline-rows";
const EXTRA_TIMELINE_HEIGHT_KEY = "basalt-extra-timeline-height";
const LOOK_PREVIEW_KEY = "basalt-look-preview";
const SHOT_COLOURING_KEY = "basalt-shot-colouring";

function savedVolume(): number {
  try { const v = parseFloat(localStorage.getItem(VOLUME_KEY) ?? ""); if (v >= 0 && v <= 1) return v; } catch { /* half */ }
  return 0.5;
}

function savedCollapsedRows(): TimelineRow[] {
  try { const rows = JSON.parse(localStorage.getItem(COLLAPSED_ROWS_KEY) ?? "[]"); if (Array.isArray(rows)) return rows; } catch { /* none */ }
  return [];
}

function savedExtraTimelineHeight(): number {
  try { const pixels = parseFloat(localStorage.getItem(EXTRA_TIMELINE_HEIGHT_KEY) ?? ""); if (pixels >= 0) return Math.min(pixels, MOST_EXTRA_TIMELINE_HEIGHT_PIXELS); } catch { /* none */ }
  return 0;
}

function savedLookPreview(): boolean {
  try { return localStorage.getItem(LOOK_PREVIEW_KEY) === "1"; } catch { return false; }
}

function savedShotColouring(): ShotColouring {
  try { const v = localStorage.getItem(SHOT_COLOURING_KEY); if (SHOT_COLOURINGS.some(([c]) => c === v)) return v as ShotColouring; } catch { /* plain */ }
  return "plain";
}

class EditorState {
  /** Indices into chart.events. */
  readonly selection = new SvelteSet<number>();
  /** Presses add to the selection, as Shift does - for touch screens, which have no Shift. */
  multiSelect = $state(false);
  /** Select mode: a drag on empty space draws a selection box at once, instead of panning or scrubbing. */
  selectMode = $state(false);
  /** Quick actions for the selection, from a long press on it: where the finger was, or null when shut. */
  quickActions = $state<{ x: number; y: number } | null>(null);
  selectedPhase = $state(-1);
  selectedLookCue = $state(-1);

  time = $state(0);
  playing = $state(false);
  /** Which editor is showing: the timeline, or the highway. */
  mainView = $state<MainView>("timeline");
  /** The timeline's view: its left edge in seconds, and pixels a second. */
  view = $state({ t0: -1, pps: 60 });
  timelineWidth = $state(800);
  readonly collapsedTimelineRows = new SvelteSet<TimelineRow>(savedCollapsedRows());
  extraTimelineHeightPixels = $state(savedExtraTimelineHeight());
  rate = $state(1);
  /** Snap in beats; 0 is off. */
  snap = $state(0.5);
  click = $state(false);
  /** How loud the editor plays - the song (times the chart's own volume) and the click. Remembered here, not saved in the chart. */
  volume = $state(savedVolume());
  /** The look preview window: the Stage look on a painted arena. Remembered here, not saved in the chart. */
  lookPreview = $state(savedLookPreview());
  /** What colours projectiles in the lane, timeline and highway. Remembered here, not saved in the chart. */
  shotColouring = $state(savedShotColouring());

  tab = $state<Tab>("chart");
  /** Counts requests to bring the settings tab into view (revealTab); each layout answers them its own way. */
  tabRevealed = $state(0);
  tapTimes = $state.raw<number[]>([]);
  confirmNew = $state(false);
  /** Shows chart.json as text to copy by hand, when the clipboard refuses. */
  showText = $state(false);
  toast = $state<{ text: string; id: number } | null>(null);

  /** Files beside the chart: song, cover, clips/*.json - path to bytes. */
  files = $state.raw(new Map<string, Uint8Array>());
  clips = $state.raw(new Map<string, ClipSpan>());
  song = $state.raw<Song | null>(null);
  cover = $state<string | null>(null);
  /** The chart folder on disk, when one was opened - Save writes chart.json back into it. */
  folder = $state<string | null>(null);
  /** Chart folders opened lately, newest first - the desktop app's File > Open recent. */
  recentFolders = $state.raw<string[]>([]);
  /** Which of your charts (store/library.svelte.ts) this is, once it is kept there. */
  libraryId = $state<string | null>(null);
  /** This chart should join your charts as soon as it can - it was just opened or started. */
  libraryAdd = $state(false);

  readonly problems = $derived([...problems(doc.chart, doc.tempo), ...fileProblems(this.files, doc.chart)]);
  readonly lookCues = $derived(timedLookCues(doc.chart, doc.tempo));

  /**
   * Shows a settings tab, wherever the layout keeps them: the desktop's tab bar is always there, so
   * it just switches; the phone opens its drawer on it (MobileApp watches `tabRevealed`). Shared code
   * asks for a tab this way rather than reaching into either layout.
   */
  revealTab(tab: Tab): void {
    this.tab = tab;
    this.tabRevealed++;
  }

  setSelection(indices: Iterable<number>): void {
    this.selection.clear();
    for (const i of indices) this.selection.add(i);
  }

  rememberVolume(): void {
    try { localStorage.setItem(VOLUME_KEY, String(this.volume)); } catch { /* not remembered */ }
  }

  toggleLookPreview(): void {
    this.lookPreview = !this.lookPreview;
    try { localStorage.setItem(LOOK_PREVIEW_KEY, this.lookPreview ? "1" : "0"); } catch { /* not remembered */ }
  }

  colourShotsBy(colouring: ShotColouring): void {
    this.shotColouring = colouring;
    try { localStorage.setItem(SHOT_COLOURING_KEY, colouring); } catch { /* not remembered */ }
  }

  rememberTimelineLayout(): void {
    try {
      localStorage.setItem(COLLAPSED_ROWS_KEY, JSON.stringify([...this.collapsedTimelineRows]));
      localStorage.setItem(EXTRA_TIMELINE_HEIGHT_KEY, String(this.extraTimelineHeightPixels));
    } catch { /* not remembered */ }
  }
}

export const editor = new EditorState();
