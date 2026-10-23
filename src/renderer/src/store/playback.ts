// Playing the chart: the song through an <audio> element (it keeps pitch at slow speeds), a clock that
// runs without a song too, and a click on every beat. Chart time = song time - music.start.
import { buildPeaks } from "../audio/peaks";
import { songType } from "../io/files";
import { endOf } from "../model/chart";
import { doc } from "./document.svelte";
import { editor } from "./editor.svelte";

let songElement: HTMLAudioElement | null = null;
function songAudio(): HTMLAudioElement {
  if (!songElement) { songElement = new Audio(); songElement.preservesPitch = true; }
  return songElement;
}
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

/** Where the playhead is this instant - fresher than editor.time, which moves once a frame. */
export const playheadNow = (): number => now();

function now(): number {
  if (!editor.playing) return editor.time;
  if (editor.song && !songAudio().paused && !unlocking) return songAudio().currentTime - songStart();
  return startTime + (performance.now() - startedAt) / 1000 * editor.rate;
}

export function play(): void {
  if (editor.playing) { pause(); return; }
  ensureAudio();
  editor.playing = true;
  startTime = editor.time; startedAt = performance.now(); lastClickBeat = -1;
  if (editor.song) {
    const at = editor.time + songStart(), audio = songAudio();
    audio.playbackRate = editor.rate; audio.volume = playbackVolume();
    if (at >= 0 && at < (editor.song.buffer?.duration ?? Infinity)) {
      audio.currentTime = at;
      audio.play().catch(() => {});
    } else if (at < 0) {
      // The song starts later (pre-roll, or the chart starting before it). Phones only let a sound
      // start from a tap, so start it silently now, while there is one, and let tick() start it for real.
      unlockQuietly(audio);
    }
  }
  requestAnimationFrame(tick);
}

let unlocking = false;
function unlockQuietly(audio: HTMLAudioElement): void {
  unlocking = true;
  audio.muted = true;
  const done = () => { if (unlocking) audio.pause(); unlocking = false; audio.muted = false; };
  audio.play().then(done, done);
}

export function pause(): void {
  editor.time = now();
  editor.playing = false;
  songAudio().pause();
}

/** Moves the playhead; playing carries on from there. */
export function seek(t: number): void {
  editor.time = t;
  if (!editor.playing) return;
  startTime = t; startedAt = performance.now();
  if (editor.song) songAudio().currentTime = Math.max(0, t + songStart());
}

export function setRate(rate: number): void {
  if (editor.playing) { editor.time = now(); startTime = editor.time; startedAt = performance.now(); }
  editor.rate = rate;
  songAudio().playbackRate = rate;
}

export function setVolume(volume: number): void {
  editor.volume = volume;
  songAudio().volume = playbackVolume();
  editor.rememberVolume();
}

function tick(): void {
  if (!editor.playing) return;
  editor.time = now();
  const at = editor.time + songStart();
  // Start the song when the chart reaches it, if the playhead began before it.
  const audio = songAudio();
  if (editor.song && (audio.paused || unlocking) && at >= 0 && at < audio.duration) {
    unlocking = false; audio.muted = false;
    audio.currentTime = at; audio.play().catch(() => {});
  }
  // Keep the playhead in view.
  keepPlayheadInView();
  if (editor.click) clickBeat();
  // To the end of the song when there is one - a chart's "end" can be well before it - else just past the chart's end.
  if (editor.time > Math.max(endOf(doc.chart, doc.tempo) + 2, songLength() ?? 0)) pause();
  else requestAnimationFrame(tick);
}

/**
 * Scrolls the timeline to the playhead if it has gone past either edge - as it does when the highway
 * moves it while the timeline isn't showing.
 */
export function keepPlayheadInView(): void {
  const view = editor.view, w = editor.timelineWidth, x = (editor.time - view.t0) * view.pps;
  if (x > w * 0.85 || x < 0) view.t0 = Math.max(-1, editor.time - (w * 0.2) / view.pps);
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
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: songType(name) }));
  editor.song = { name, url, buffer: null, peaks: null };
  songAudio().src = url;
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
  songAudio().removeAttribute("src");
}
