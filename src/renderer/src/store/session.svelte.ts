// The chart's surroundings this session: the files opened beside it (song, cover, clips), where it
// came from and where it saves, and what is wrong with it. store/files.ts fills these in.
import type { Peaks } from "../audio/peaks";
import { fileProblems, type ClipSpan } from "../io/files";
import { problems } from "../model/problems";
import { doc } from "./document.svelte";

export type Song = { name: string; url: string; buffer: AudioBuffer | null; peaks: Peaks | null };

class Session {
  /** Files beside the chart: song, cover, clips/*.json - path to bytes. */
  files = $state.raw(new Map<string, Uint8Array>());
  clips = $state.raw(new Map<string, ClipSpan>());
  song = $state.raw<Song | null>(null);
  cover = $state<string | null>(null);
  /** The chart folder on disk, when one was opened - Save writes chart.json back into it. */
  folder = $state<string | null>(null);
  /**
   * The chart's name and difficulty when its folder was opened or last saved: a folder named after them
   * follows the chart when Save finds them changed (shared/folders.ts).
   */
  folderNamedFor: { name: string; difficulty?: string } | null = null;
  /** Chart folders opened lately, newest first - the desktop app's File > Open recent. */
  recentFolders = $state.raw<string[]>([]);
  /** Which of your charts (store/library.svelte.ts) this is, once it is kept there. */
  libraryId = $state<string | null>(null);
  /** This chart should join your charts as soon as it can - it was just opened or started. */
  libraryAdd = $state(false);

  /** What's wrong with the chart and its files: the Problems tab. */
  readonly problems = $derived([...problems(doc.chart, doc.tempo), ...fileProblems(this.files, doc.chart)]);
}

export const session = new Session();
