// Tapping along: while the song plays, each tap on a pad drops a projectile in that column at that
// moment (snapped). The taps of one play-through are a take, and a take is one undo step. In replace
// mode a take also clears the projectiles it was recorded over.
import { evTime, firstActorId, laneOf } from "../model/chart";
import { straightProjectile, xOfColumn } from "../model/columns";
import { newTimed } from "../model/edits";
import { afterReplacing, sameTap } from "../model/takes";
import type { ChartEvent, LoadedChart } from "../model/types";
import { addProjectileInColumn, toast } from "./actions";
import { doc } from "./document.svelte";
import { editor } from "./editor.svelte";
import { playheadNow } from "./playback";
import { practice } from "./practice.svelte";

export type RecordMode = "add" | "replace";

type Take = { chart: LoadedChart; before: string; from: number; to: number; added: ChartEvent[]; taps: { t: number; column: number }[] };

const OFFSET_KEY = "basalt-tap-offset";

/** On a keyboard, the keys that tap the highway's columns, left to right. */
export const RECORD_KEYS = ["1", "2", "3", "4", "5"];

function savedOffset(): number {
  try { const ms = parseFloat(localStorage.getItem(OFFSET_KEY) ?? ""); if (Number.isFinite(ms)) return ms; } catch { /* none */ }
  return 0;
}

class Recording {
  /** Showing the pads: taps while playing record. */
  armed = $state(false);
  mode = $state<RecordMode>("add");
  /** Taps in the take so far. */
  count = $state(0);
  /** Taken off each tap's time, to make up for the screen's and the speaker's delay - in milliseconds. */
  offsetMs = $state(savedOffset());
  #take: Take | null = null;

  /** A pad tapped. Playing, it adds to the take; paused, it just adds a projectile at the playhead. */
  hit(column: number): void {
    if (!editor.playing) { addProjectileInColumn(editor.time, column); return; }
    if (this.#take && this.#take.chart !== doc.chart) this.#take = null; // undone or reloaded mid-take
    const t = Math.max(0, playheadNow() - this.offsetMs / 1000 * editor.rate);
    const c = doc.chart, ev = newTimed(c, t, doc.tempo, editor.snap), at = evTime(ev, doc.tempo);
    const take = this.#take ??= { chart: c, before: doc.text, from: at, to: at, added: [], taps: [] };
    if (take.taps.some(tap => sameTap(tap, { t: at, column }))) return;
    ev.projectile = straightProjectile(c, xOfColumn(column, laneOf(c).width), firstActorId(c));
    c.events.push(ev);
    take.added.push(c.events.at(-1)!);
    take.taps.push({ t: at, column });
    take.from = Math.min(take.from, at);
    take.to = Math.max(take.to, at);
    this.count = take.added.length;
  }

  /** Arms recording - showing the highway, where the pads are - or disarms it, ending any take. */
  toggle(): void {
    this.finish();
    this.armed = !this.armed;
    if (this.armed) editor.mainView = "highway";
  }

  /** Ends the take in progress - one undo step - and selects what it added. */
  finish(): void {
    const take = this.#take;
    this.#take = null;
    this.count = 0;
    if (!take || take.chart !== doc.chart || !take.added.length) return;
    let replaced = 0;
    if (this.mode === "replace") {
      // The loop, when there is one, rather than just the take's first tap to its last.
      const [from, to] = practice.loop ?? [take.from, take.to];
      const before = doc.chart.events.length;
      doc.chart.events = afterReplacing(doc.chart.events, new Set(take.added), from, to, doc.tempo);
      replaced = before - doc.chart.events.length;
    }
    doc.commit(take.before, ["events"]);
    editor.setSelection(take.added.map(e => doc.chart.events.indexOf(e)).filter(i => i >= 0));
    toast(`Recorded ${take.added.length}${replaced ? `, replacing ${replaced}` : ""} - Undo takes the whole take back`);
  }

  setOffset(ms: number): void {
    this.offsetMs = Math.round(ms);
    try { localStorage.setItem(OFFSET_KEY, String(this.offsetMs)); } catch { /* not remembered */ }
  }
}

export const recording = new Recording();
