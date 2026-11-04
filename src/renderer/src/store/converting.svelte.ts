// Making looks with a converter (video/converters.ts): which one, its options, the video it read and the chart's song it
// heard. The video is read once; changing an option makes the looks again at once from what was read. Adding them is
// one undo step, and they are ordinary looks after that - edited, moved or deleted like any other.
import { rhythmOf } from "../audio/rhythm";
import { evTime } from "../model/chart";
import { isCueForPack, STAGE_PACK } from "../model/looks";
import type { LookCue } from "../model/types";
import { defaultOptions, findConverter, LOOK_CONVERTERS, type OptionValues } from "../video/converters";
import type { FrameFeatures } from "../video/frames";
import type { SongRhythm } from "../video/looks";
import { toast } from "./actions";
import { doc } from "./document.svelte";
import { songOffset } from "./playback";
import { session } from "./session.svelte";
import { readVideoFrames } from "./videoReader";

export type ConvertingState =
  | { kind: "empty" }
  | { kind: "reading"; what: string; done: number }
  | { kind: "ready" }
  | { kind: "failed"; why: string };

class Converting {
  /** The converter's section of the Looks tab is showing. */
  open = $state(false);
  converterId = $state(LOOK_CONVERTERS[0].id);
  options = $state<OptionValues>(defaultOptions(LOOK_CONVERTERS[0]));
  state = $state<ConvertingState>({ kind: "empty" });
  videoName = $state<string | null>(null);
  /** Where the video starts in the chart: by default, where the song starts, as a music video's sound is the song. */
  videoStart = $state(0);
  /** Adding replaces the Stage looks the video spans, rather than going alongside them. */
  replace = $state(true);
  frames = $state.raw<FrameFeatures[] | null>(null);
  duration = $state(0);
  song = $state.raw<SongRhythm | null>(null);
  #reading: AbortController | null = null;

  get converter() { return findConverter(this.converterId); }

  /** The looks the converter makes from what was read, with the options as they are. */
  readonly cues = $derived.by((): LookCue[] => this.frames
    ? this.converter.generate({ frames: this.frames, song: this.converter.usesSong ? this.song : null, tempo: doc.tempo, videoStart: this.videoStart }, this.options)
    : []);

  /** The stretch of the chart the video covers. */
  get span(): [number, number] { return [Math.max(0, this.videoStart), this.videoStart + this.duration]; }

  show(): void { this.open = true; }
  close(): void { this.cancel(); this.open = false; }

  setConverter(id: string): void {
    this.converterId = findConverter(id).id;
    this.options = defaultOptions(this.converter);
  }

  setOption(id: string, value: number | readonly string[]): void { this.options = { ...this.options, [id]: value }; }

  /** Picks a video and reads it. */
  async chooseVideo(): Promise<void> {
    const [file] = await window.editor.openFiles("video");
    if (file) await this.read(file.path.split(/[\\/]/).pop()!, file.bytes);
  }

  /** Reads a video, and hears the chart's song if the converter listens to it. A video read before is let go. */
  async read(name: string, bytes: Uint8Array): Promise<void> {
    this.cancel();
    const reading = this.#reading = new AbortController();
    this.videoName = name;
    this.frames = null;
    this.videoStart = Math.round(-songOffset() * 1000) / 1000;
    try {
      this.state = { kind: "reading", what: "Reading the video", done: 0 };
      const read = await readVideoFrames(bytes, done => { if (this.#reading === reading) this.state = { kind: "reading", what: "Reading the video", done }; }, reading.signal);
      this.song = null;
      const buffer = session.song?.buffer;
      if (this.converter.usesSong && buffer) {
        this.state = { kind: "reading", what: "Listening to the song", done: 1 };
        // Let the page draw that before the song's analysis holds it up for a moment.
        await new Promise(resolve => setTimeout(resolve, 30));
        this.song = { rhythm: rhythmOf(buffer.getChannelData(0), buffer.sampleRate), offset: songOffset() };
      }
      if (this.#reading !== reading) return;
      this.duration = read.duration;
      this.frames = read.frames;
      this.state = { kind: "ready" };
    } catch (error) {
      if (this.#reading !== reading) return;
      this.state = reading.signal.aborted ? { kind: "empty" } : { kind: "failed", why: (error as Error).message };
      if (reading.signal.aborted) this.videoName = null;
    } finally {
      if (this.#reading === reading) this.#reading = null;
    }
  }

  cancel(): void {
    this.#reading?.abort();
  }

  /** Adds the looks to the chart, as one undo step: in place of the Stage looks the video spans, or alongside them. */
  add(): void {
    const made = this.cues;
    if (!made.length) return;
    const [from, to] = this.span, tempo = doc.tempo;
    doc.change(["shaders"], () => {
      const kept = (doc.chart.shaders ?? []).filter(cue => {
        if (!this.replace || !isCueForPack(cue, STAGE_PACK)) return true;
        const time = evTime(cue, tempo);
        return !(time >= from && time <= to);
      });
      doc.chart.shaders = [...kept, ...made.map(cue => JSON.parse(JSON.stringify(cue)) as LookCue)];
    });
    toast(`Added ${made.length} looks from ${this.videoName ?? "the video"}`);
  }
}

export const converting = new Converting();
