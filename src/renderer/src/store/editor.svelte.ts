// What the editor is doing, as opposed to what the chart says: selection, playhead, view, the files
// opened beside the chart.
import { SvelteSet } from "svelte/reactivity";
import type { Peaks } from "../audio/peaks";
import type { ClipSpan } from "../io/files";
import { problems } from "../model/problems";
import { doc } from "./document.svelte";

export type Tab = "chart" | "tempo" | "actors" | "problems" | "help";
export type Song = { name: string; url: string; buffer: AudioBuffer | null; peaks: Peaks | null };

const VOLUME_KEY = "bb-editor-volume";

function savedVolume(): number {
  try { const v = parseFloat(localStorage.getItem(VOLUME_KEY) ?? ""); if (v >= 0 && v <= 1) return v; } catch { /* half */ }
  return 0.5;
}

class EditorState {
  /** Indices into chart.events. */
  readonly selection = new SvelteSet<number>();
  selectedPhase = $state(-1);

  time = $state(0);
  playing = $state(false);
  /** The timeline's view: its left edge in seconds, and pixels a second. */
  view = $state({ t0: -1, pps: 60 });
  timelineWidth = $state(800);
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

  setSelection(indices: Iterable<number>): void {
    this.selection.clear();
    for (const i of indices) this.selection.add(i);
  }

  rememberVolume(): void {
    try { localStorage.setItem(VOLUME_KEY, String(this.volume)); } catch { /* not remembered */ }
  }
}

export const editor = new EditorState();
