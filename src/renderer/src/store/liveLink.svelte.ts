// The live link: shows the chart's looks on the real shaders in the running game, through RumbleReShaded.
// Entirely optional. Nothing here runs until someone connects, the chart is never touched, and the
// desktop app's main process holds the connection (src/main/liveLink.ts); the website has none.
import type { LiveLinkPack } from "../../../shared/api";
import { beatGlobals, looksToShow, shownTime } from "../model/liveLink";
import { toast } from "./actions";
import { doc } from "./document.svelte";
import { editing } from "./editing.svelte";
import { transport } from "./transport.svelte";

/** Enough for sliders and scrubbing to feel live, without flooding the game. */
const SEND_EVERY_MS = 33;

class LiveLink {
  state = $state<"off" | "connecting" | "on">("off");
  #packs: LiveLinkPack[] = [];
  /** The packs the game is showing a look on for us, to hand back when they have none. */
  #showing = new Set<string>();
  #lastSent = "";
  #timer = 0;
  #stopWatching: (() => void) | null = null;
  /**
   * The game's link can set Basalt's globals too, so it shows the beat - pulse, flashes, the lights' strobe and chase -
   * as a battle would. Those go every frame the playhead moves, rather than at the looks' pace, so a fast strobe isn't
   * missed between updates.
   */
  #beats = false;
  #beatFrame = 0;
  #lastBeat = "";

  /** Whether this editor can link at all: the desktop app. */
  get available(): boolean { return !!window.editor?.connectLiveLink; }

  async toggle(): Promise<void> {
    if (this.state === "on") { this.disconnect(); return; }
    if (this.state === "connecting") return;
    this.state = "connecting";
    try {
      window.editor.onLiveLinkClosed!(() => this.#closed());
      const greeting = await window.editor.connectLiveLink!();
      this.#packs = greeting.packs;
      this.#beats = greeting.features.includes("globals");
      this.state = "on";
      this.#watch();
      toast(this.#beats ? "Linked to the game: looks and the beat now show there" : "Linked to the game: looks now show there");
    } catch {
      this.state = "off";
      toast("Couldn't reach the game. With it running, turn on Live link in RumbleReShaded's settings");
    }
  }

  disconnect(): void {
    this.#stop();
    void window.editor.disconnectLiveLink?.();
  }

  #closed(): void {
    if (this.state !== "on") return;
    this.#stop();
    toast("The link to the game closed");
  }

  #stop(): void {
    this.state = "off";
    this.#stopWatching?.();
    this.#stopWatching = null;
    clearTimeout(this.#timer);
    this.#timer = 0;
    cancelAnimationFrame(this.#beatFrame);
    this.#beatFrame = 0;
    this.#showing.clear();
    this.#lastSent = "";
    this.#lastBeat = "";
  }

  #watch(): void {
    this.#stopWatching = $effect.root(() => {
      $effect(() => {
        void doc.lookCues; void transport.time; void transport.playing; void editing.selectedLookCue;
        if (!this.#timer) this.#timer = window.setTimeout(() => this.#send(), SEND_EVERY_MS);
      });
      $effect(() => {
        void transport.time; void doc.tempo;
        if (this.#beats && !this.#beatFrame) this.#beatFrame = requestAnimationFrame(() => this.#sendBeat());
      });
    });
  }

  #sendBeat(): void {
    this.#beatFrame = 0;
    const globals = beatGlobals(transport.time, doc.tempo), text = JSON.stringify(globals);
    if (text === this.#lastBeat) return;
    this.#lastBeat = text;
    void window.editor.sendLiveLink?.({ looks: [], released: [], globals });
  }

  #send(): void {
    this.#timer = 0;
    const cues = doc.lookCues, time = shownTime(cues, transport.time, transport.playing, editing.selectedLookCue);
    const looks = looksToShow(cues, time, this.#packs), showing = new Set(looks.map(look => look.pack));
    const update = { looks, released: [...this.#showing].filter(pack => !showing.has(pack)) };
    const text = JSON.stringify(update);
    if (text === this.#lastSent) return;
    this.#lastSent = text;
    this.#showing = showing;
    void window.editor.sendLiveLink?.(update);
  }
}

export const liveLink = new LiveLink();
