// What the editor is doing, as opposed to what the chart says: selection, playhead, view, the files
// opened beside the chart.
import { SvelteSet } from "svelte/reactivity";
import type { Peaks } from "../audio/peaks";
import type { ClipSpan } from "../io/files";
import { timedLookCues } from "../model/looks";
import { problems } from "../model/problems";
import { MOST_EXTRA_TIMELINE_HEIGHT_PIXELS, type TimelineRow } from "../views/timeline/geometry";
import { doc } from "./document.svelte";

export type Tab = "chart" | "phases" | "looks" | "tempo" | "actors" | "problems" | "help";
export type Song = { name: string; url: string; buffer: AudioBuffer | null; peaks: Peaks | null };

const VOLUME_KEY = "bb-editor-volume";
const COLLAPSED_ROWS_KEY = "bb-editor-collapsed-timeline-rows";
const EXTRA_TIMELINE_HEIGHT_KEY = "bb-editor-extra-timeline-height";

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

class EditorState {
  /** Indices into chart.events. */
  readonly selection = new SvelteSet<number>();
  selectedPhase = $state(-1);
  selectedLookCue = $state(-1);

  time = $state(0);
  playing = $state(false);
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

  tab = $state<Tab>("chart");
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

  readonly problems = $derived(problems(doc.chart, doc.tempo));
  readonly lookCues = $derived(timedLookCues(doc.chart, doc.tempo));

  setSelection(indices: Iterable<number>): void {
    this.selection.clear();
    for (const i of indices) this.selection.add(i);
  }

  rememberVolume(): void {
    try { localStorage.setItem(VOLUME_KEY, String(this.volume)); } catch { /* not remembered */ }
  }

  rememberTimelineLayout(): void {
    try {
      localStorage.setItem(COLLAPSED_ROWS_KEY, JSON.stringify([...this.collapsedTimelineRows]));
      localStorage.setItem(EXTRA_TIMELINE_HEIGHT_KEY, String(this.extraTimelineHeightPixels));
    } catch { /* not remembered */ }
  }
}

export const editor = new EditorState();
