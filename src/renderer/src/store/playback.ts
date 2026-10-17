// Playing the chart: the song through an <audio> element (it keeps pitch at slow speeds), a clock that
// runs without a song too, and a click on every beat. Chart time = song time - music.start.
import { buildPeaks } from "../audio/peaks";
import { endOf } from "../model/chart";
import { doc } from "./document.svelte";
import { editor } from "./editor.svelte";

const audio = new Audio();
audio.preservesPitch = true;
let context: AudioContext | null = null;
let startedAt = 0, startTime = 0, lastClickBeat = -1;

/** Where the chart starts in the song, in seconds. */
export const songStart = (): number => +(doc.chart.music?.start || 0);
/** How long the song runs in chart time, or null with no song open. */
export const songLength = (): number | null => editor.song?.buffer ? editor.song.buffer.duration - songStart() : null;
/** The editor's own volume times the chart's song volume. */
const playbackVolume = (): number => Math.min(1, Math.max(0, editor.volume * +(doc.chart.music?.volume ?? 1)));

export function ensureAudio(): AudioContext | null {
  try {
    context ??= new AudioContext();
    void context.resume();
  } catch { context = null; }
  return context;
}

function now(): number {
  if (!editor.playing) return editor.time;
  if (editor.song && !audio.paused) return audio.currentTime - songStart();
  return startTime + (performance.now() - startedAt) / 1000 * editor.rate;
}

export function play(): void {
  if (editor.playing) { pause(); return; }
  ensureAudio();
  editor.playing = true;
  startTime = editor.time; startedAt = performance.now(); lastClickBeat = -1;
  if (editor.song) {
    const at = editor.time + songStart();
    if (at >= 0 && at < (editor.song.buffer?.duration ?? Infinity)) {
      audio.currentTime = at; audio.playbackRate = editor.rate; audio.volume = playbackVolume();
      audio.play().catch(() => {});
    }
  }
  requestAnimationFrame(tick);
}

export function pause(): void {
  editor.time = now();
  editor.playing = false;
  audio.pause();
}

/** Moves the playhead; playing carries on from there. */
export function seek(t: number): void {
  editor.time = t;
  if (!editor.playing) return;
  startTime = t; startedAt = performance.now();
  if (editor.song) audio.currentTime = Math.max(0, t + songStart());
}

export function setRate(rate: number): void {
  if (editor.playing) { editor.time = now(); startTime = editor.time; startedAt = performance.now(); }
  editor.rate = rate;
  audio.playbackRate = rate;
}

export function setVolume(volume: number): void {
  editor.volume = volume;
  audio.volume = playbackVolume();
  editor.rememberVolume();
}

function tick(): void {
  if (!editor.playing) return;
  editor.time = now();
  const at = editor.time + songStart();
  // Start the song when the chart reaches it, if the playhead began before it.
  if (editor.song && audio.paused && at >= 0 && at < audio.duration) { audio.currentTime = at; audio.play().catch(() => {}); }
  // Keep the playhead in view.
  const view = editor.view, w = editor.timelineWidth;
  if ((editor.time - view.t0) * view.pps > w * 0.85) view.t0 = editor.time - (w * 0.2) / view.pps;
  if (editor.click) clickBeat();
  // To the end of the song when there is one - a chart's "end" can be well before it - else just past the chart's end.
  if (editor.time > Math.max(endOf(doc.chart, doc.tempo) + 2, songLength() ?? 0)) pause();
  else requestAnimationFrame(tick);
}

function clickBeat(): void {
  const tp = doc.tempo;
  if (!tp.ok || !context) return;
  const beat = Math.floor(tp.beat(editor.time));
  if (beat === lastClickBeat || beat < 0) return;
  lastClickBeat = beat;
  const o = context.createOscillator(), g = context.createGain(), t = context.currentTime;
  o.frequency.value = beat % 4 === 0 ? 1500 : 1000;
  g.gain.setValueAtTime(Math.max(0.001, 0.25 * editor.volume), t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  o.connect(g).connect(context.destination);
  o.start(t); o.stop(t + 0.06);
}

/** Loads a song: plays it, and decodes it for the waveform. False if it could not be decoded. */
export async function loadSong(name: string, bytes: Uint8Array): Promise<boolean> {
  if (editor.song?.url) URL.revokeObjectURL(editor.song.url);
  const url = URL.createObjectURL(new Blob([bytes as BlobPart]));
  editor.song = { name, url, buffer: null, peaks: null };
  audio.src = url;
  try {
    const decoder = ensureAudio() ?? new OfflineAudioContext(1, 1, 44100);
    const buffer = await decoder.decodeAudioData(bytes.slice().buffer);
    if (editor.song?.url === url) editor.song = { ...editor.song, buffer, peaks: buildPeaks(buffer.getChannelData(0), buffer.sampleRate) };
    return true;
  } catch {
    return false;
  }
}

export function unloadSong(): void {
  if (editor.song?.url) URL.revokeObjectURL(editor.song.url);
  editor.song = null;
  audio.removeAttribute("src");
}
