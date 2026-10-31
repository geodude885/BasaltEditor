// Playing the chart: the song through an <audio> element (it keeps pitch at slow speeds), a clock that
// runs without a song too, and a click on every beat. Chart time = song time - music.offset.
import { buildPeaks } from "../audio/peaks";
import { mp3InsideWav } from "../audio/riff";
import { songType } from "../io/files";
import { endOf } from "../model/chart";
import { doc } from "./document.svelte";
import { display } from "./display.svelte";
import { session } from "./session.svelte";
import { transport } from "./transport.svelte";

let songElement: HTMLAudioElement | null = null;
function songAudio(): HTMLAudioElement {
  if (!songElement) { songElement = new Audio(); songElement.preservesPitch = true; }
  return songElement;
}
let context: AudioContext | null = null;
let startedAt = 0, startTime = 0, lastClickBeat = -1;

/** Where the chart starts in the song, in seconds. */
export const songOffset = (): number => +(doc.chart.music?.offset || 0);
/** How long the song runs in chart time, or null with no song open. */
export const songLength = (): number | null => session.song?.buffer ? session.song.buffer.duration - songOffset() : null;
/** The editor's own volume times the chart's song volume. */
const playbackVolume = (): number => Math.min(1, Math.max(0, transport.volume * +(doc.chart.music?.volume ?? 1)));

export function ensureAudio(): AudioContext | null {
  try {
    context ??= new AudioContext();
    void context.resume();
  } catch { context = null; }
  return context;
}

/** Where the playhead is this instant - fresher than transport.time, which moves once a frame. */
export const playheadNow = (): number => now();

function now(): number {
  if (!transport.playing) return transport.time;
  if (session.song && !songAudio().paused && !unlocking) return songAudio().currentTime - songOffset();
  return startTime + (performance.now() - startedAt) / 1000 * transport.rate;
}

export function play(): void {
  if (transport.playing) { pause(); return; }
  ensureAudio();
  transport.playing = true;
  startTime = transport.time; startedAt = performance.now(); lastClickBeat = -1;
  if (session.song) {
    const at = transport.time + songOffset(), audio = songAudio();
    audio.playbackRate = transport.rate; audio.volume = playbackVolume();
    if (at >= 0 && at < (session.song.buffer?.duration ?? Infinity)) {
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
  transport.time = now();
  transport.playing = false;
  songAudio().pause();
}

/** Moves the playhead; playing carries on from there. */
export function seek(t: number): void {
  transport.time = t;
  if (!transport.playing) return;
  startTime = t; startedAt = performance.now();
  if (session.song) songAudio().currentTime = Math.max(0, t + songOffset());
}

export function setRate(rate: number): void {
  if (transport.playing) { transport.time = now(); startTime = transport.time; startedAt = performance.now(); }
  transport.rate = rate;
  songAudio().playbackRate = rate;
}

export function setVolume(volume: number): void {
  transport.volume = volume;
  songAudio().volume = playbackVolume();
  transport.rememberVolume();
}

function tick(): void {
  if (!transport.playing) return;
  transport.time = now();
  const at = transport.time + songOffset();
  // Start the song when the chart reaches it, if the playhead began before it.
  const audio = songAudio();
  if (session.song && (audio.paused || unlocking) && at >= 0 && at < audio.duration) {
    unlocking = false; audio.muted = false;
    audio.currentTime = at; audio.play().catch(() => {});
  }
  // Keep the playhead in view.
  keepPlayheadInView();
  if (transport.click) clickBeat();
  // To the end of the song when there is one - a chart's "end" can be well before it - else just past the chart's end.
  if (transport.time > Math.max(endOf(doc.chart, doc.tempo) + 2, songLength() ?? 0)) pause();
  else requestAnimationFrame(tick);
}

/**
 * Scrolls the timeline to the playhead if it has gone past either edge - as it does when the highway
 * moves it while the timeline isn't showing.
 */
export function keepPlayheadInView(): void {
  const view = display.timeline, w = display.timelineWidth, x = (transport.time - view.t0) * view.pps;
  if (x > w * 0.85 || x < 0) view.t0 = Math.max(-1, transport.time - (w * 0.2) / view.pps);
}

function clickBeat(): void {
  const tp = doc.tempo;
  if (!tp.ok || !context) return;
  const beat = Math.floor(tp.beat(transport.time));
  if (beat === lastClickBeat || beat < 0) return;
  lastClickBeat = beat;
  const o = context.createOscillator(), g = context.createGain(), t = context.currentTime;
  o.frequency.value = beat % 4 === 0 ? 1500 : 1000;
  g.gain.setValueAtTime(Math.max(0.001, 0.25 * transport.volume), t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  o.connect(g).connect(context.destination);
  o.start(t); o.stop(t + 0.06);
}

/** Loads a song: plays it, and decodes it for the waveform. False if it could not be decoded. */
export async function loadSong(name: string, bytes: Uint8Array): Promise<boolean> {
  if (session.song?.url) URL.revokeObjectURL(session.song.url);
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: songType(name) }));
  session.song = { name, url, buffer: null, peaks: null };
  songAudio().src = url;
  const decoder = ensureAudio() ?? new OfflineAudioContext(1, 1, 44100);
  // An MP3 inside a WAV wrapper is decoded from the MP3 inside, which more decoders understand.
  const inside = mp3InsideWav(bytes);
  for (const attempt of inside ? [inside, bytes] : [bytes]) {
    try {
      const buffer = await decoder.decodeAudioData(attempt.slice().buffer);
      if (session.song?.url === url) session.song = { ...session.song, buffer, peaks: buildPeaks(buffer.getChannelData(0), buffer.sampleRate) };
      return true;
    } catch { /* try the next, if any */ }
  }
  return false;
}

export function unloadSong(): void {
  if (session.song?.url) URL.revokeObjectURL(session.song.url);
  session.song = null;
  songAudio().removeAttribute("src");
}
