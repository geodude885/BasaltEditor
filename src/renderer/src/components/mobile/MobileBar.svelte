<script lang="ts">
  // The phone layout's one bar: the menu, the chart, playing, snapping, undo and the problem count.
  import Icon from "../Icon.svelte";
  import { round } from "../../model/tempo";
  import { redo, undo } from "../../store/actions";
  import { doc } from "../../store/document.svelte";
  import { editor } from "../../store/editor.svelte";
  import { mobile } from "../../store/mobile.svelte";
  import { seek } from "../../store/playback";
  import { playOrPause } from "../../store/practice";
  import { num } from "../fields";

  const count = $derived(editor.problems.length);
  const clock = $derived.by(() => {
    const t = Math.max(0, editor.time), tp = doc.tempo;
    return {
      time: `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, "0")}`,
      beat: tp.ok ? `${round(tp.beat(editor.time) + 1, 1)}` : "",
    };
  });
</script>

<header class="bar">
  <button class="icon" aria-label="Menu" aria-expanded={mobile.menu} onclick={() => { mobile.menu = !mobile.menu; mobile.drawer = null; }}><Icon name="menu" /></button>
  <button class="primary play" onclick={playOrPause}>{editor.playing ? "Pause" : "Play"}</button>
  <!-- The rest scrolls sideways when the screen is too narrow for it all (portrait). -->
  <div class="scroll">
  <div class="name">{doc.chart.name || "Untitled"}{doc.dirty ? " •" : ""}</div>
  <button class="icon" aria-label="Back to the start" onclick={() => seek(0)}><Icon name="start" /></button>
  <div class="clock" aria-label="Playhead">{clock.time}{#if clock.beat}<small>b{clock.beat}</small>{/if}</div>
  <select aria-label="Snap" value={String(editor.snap)} onchange={e => { editor.snap = num(e); }}>
    <option value="1">1 beat</option><option value="0.5">1/2</option><option value="0.25">1/4</option><option value="0.125">1/8</option><option value="0">no snap</option>
  </select>
  <div class="views" role="group" aria-label="Editor">
    <button class:on={mobile.view === "timeline"} aria-pressed={mobile.view === "timeline"} onclick={() => { mobile.view = "timeline"; }}>Timeline</button>
    <button class:on={mobile.view === "highway"} aria-pressed={mobile.view === "highway"} onclick={() => { mobile.view = "highway"; }}>Highway</button>
  </div>
  </div>
  <button class="icon" aria-label="Undo" disabled={!doc.canUndo} onclick={undo}><Icon name="undo" /></button>
  <button class="icon" aria-label="Redo" disabled={!doc.canRedo} onclick={redo}><Icon name="redo" /></button>
  <button class="chip" class:bad={count} aria-label="{count} problems" onclick={() => mobile.toggleDrawer("problems")}>{count}</button>
</header>

<style>
  .bar {
    padding-top: max(4px, env(safe-area-inset-top));
    display: flex; align-items: center; gap: 6px; padding: 4px 8px; padding-left: max(8px, env(safe-area-inset-left));
    padding-right: max(8px, env(safe-area-inset-right)); border-bottom: 1px solid var(--line); background: var(--panel); min-width: 0;
  }
  button { min-height: 36px; }
  .icon { min-width: 40px; padding: 4px 8px; font-size: 18px; line-height: 1; }
  .play { min-width: 64px; }
  .name { font: 600 16px/1.1 var(--display); max-width: 18ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 0 1 auto; min-width: 0; }
  .clock { font: 500 14px/1 var(--mono); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .clock small { font-size: 11px; color: var(--text-dim); margin-left: 4px; }
  select { padding: 6px 4px; min-height: 36px; }
  .scroll {
    flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; overflow-x: auto; overscroll-behavior-x: contain;
    scrollbar-width: none; touch-action: pan-x;
  }
  .scroll::-webkit-scrollbar { display: none; }
  .scroll > * { flex: none; }
  .views { display: flex; }
  .views button { border-radius: 0; padding: 4px 8px; font: 600 13px var(--display); text-transform: uppercase; letter-spacing: .04em; }
  .views button:first-child { border-radius: 6px 0 0 6px; }
  .views button:last-child { border-radius: 0 6px 6px 0; border-left: 0; }
  .chip { min-width: 36px; border-radius: 999px; font: 500 13px var(--mono); color: var(--good); }
  .chip.bad { color: var(--bad); border-color: var(--bad); }
  .name { max-width: 14ch; }
</style>
