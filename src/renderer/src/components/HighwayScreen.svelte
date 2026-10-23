<script lang="ts">
  // The highway with its recording pads under it, one per column, and its practice controls beside it,
  // in either layout. Arm recording and play: each pad tap - or key 1 to 5 - drops a projectile in that
  // column, snapped. Pausing ends the take.
  import Icon from "./Icon.svelte";
  import { untrack } from "svelte";
  import { editor } from "../store/editor.svelte";
  import { commandButton } from "../store/commands";
  import { loopPointLabel, practice } from "../store/practice.svelte";
  import { RECORD_KEYS, recording, type RecordMode } from "../store/recording.svelte";
  import Highway from "../views/highway/Highway.svelte";
  import { highwayColumns } from "../views/highway/geometry";
  import Minimap from "./Minimap.svelte";

  const columns = highwayColumns();

  // A take ends when playing stops, and when the highway goes away.
  $effect(() => { if (!editor.playing) untrack(() => recording.finish()); });
  $effect(() => () => recording.finish());

  const pads: HTMLButtonElement[] = [];

  /** A column tapped, by a pad or its key: record it, and light the pad up. */
  function hit(index: number): void {
    const column = columns[index];
    recording.hit(column.column);
    navigator.vibrate?.(8);
    const el = pads[index];
    el?.classList.add("hit");
    setTimeout(() => el?.classList.remove("hit"), 110);
  }

  function key(ev: KeyboardEvent): void {
    if (!recording.armed || ev.repeat || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if ((ev.target as Element).closest?.("input, select, textarea")) return;
    const index = RECORD_KEYS.indexOf(ev.key);
    if (index < 0 || index >= columns.length) return;
    ev.preventDefault();
    hit(index);
  }

  const MODES: [RecordMode, string][] = [["add", "Add"], ["replace", "Replace"]];
</script>

<svelte:window onkeydown={key} />

<div class="screen">
  <div class="road">
    <div class="canvasbox"><Highway loop={practice.loop} /></div>
    {#if recording.armed}
      <div class="pads" style:grid-template-columns="repeat({columns.length}, minmax(0, 1fr))">
        {#each columns as column, index (index)}
          <button class="pad" aria-label="Tap {column.label}" aria-keyshortcuts={RECORD_KEYS[index]} bind:this={pads[index]}
            onpointerdown={ev => { ev.preventDefault(); hit(index); }}><kbd>{RECORD_KEYS[index]}</kbd></button>
        {/each}
      </div>
    {/if}
  </div>
  <div class="controls">
    <button class="rec" class:on={recording.armed} {...commandButton("record")}><Icon name="record" /> Rec</button>
    {#if recording.armed}
      <div class="modes" role="group" aria-label="Recording mode">
        {#each MODES as [mode, label] (mode)}
          <button class:on={recording.mode === mode} aria-pressed={recording.mode === mode} onclick={() => { recording.mode = mode; }}>{label}</button>
        {/each}
      </div>
      <div class="count" aria-live="polite">{recording.count ? `${recording.count} in take` : editor.playing ? "Tap along" : "Play to record"}</div>
    {/if}
    <div class="pair">
      <button aria-label="Back a bar" {...commandButton("back-bar")}>−bar</button>
      <button aria-label="Back 5 seconds" {...commandButton("back-5s")}>−5s</button>
    </div>
    <button {...commandButton("last-play")}><Icon name="back" /> Last play</button>
    <button class:on={practice.loopStart != null} {...commandButton("loop")}>{loopPointLabel()}</button>
    <button {...commandButton("preroll")}>Pre-roll</button>
    <Minimap />
  </div>
</div>

<style>
  .screen { height: 100%; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 96px; }
  .road { min-height: 0; min-width: 0; display: flex; flex-direction: column; }
  .canvasbox { flex: 1; min-height: 0; position: relative; }
  .pads { display: grid; gap: 4px; padding: 4px; height: 64px; flex: none; background: var(--panel); border-top: 1px solid var(--line); }
  .pad {
    border-radius: 8px; border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent); padding: 0;
    background: color-mix(in srgb, var(--accent) 14%, var(--raised)); touch-action: none;
  }
  .pad:global(.hit) { background: var(--accent); }
  .pad kbd { font: 12px var(--mono); color: var(--text-dim); }
  /* Touch screens have no keys to show. */
  @media (pointer: coarse) { .pad kbd { display: none; } }
  .controls {
    display: flex; flex-direction: column; gap: 6px; padding: 6px; border-left: 1px solid var(--line); background: var(--panel);
    overflow-y: auto; overscroll-behavior: contain;
  }
  .controls button { min-height: 40px; white-space: normal; padding: 4px; }
  .rec.on { background: var(--bad); border-color: var(--bad); color: var(--on-accent); }
  .modes { display: grid; gap: 2px; }
  .count { font-size: 12px; color: var(--text-dim); text-align: center; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
  .pair button { font-size: 12px; }

  :global(.shell.portrait) .screen { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto; }
  :global(.shell.portrait) .controls { flex-direction: row; flex-wrap: wrap; border-left: 0; border-top: 1px solid var(--line); }
  :global(.shell.portrait) .modes { grid-auto-flow: column; }
  :global(.shell.portrait) .controls :global(.map) { display: none; }
</style>
