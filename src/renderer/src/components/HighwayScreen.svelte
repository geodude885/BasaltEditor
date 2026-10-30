<script lang="ts">
  // The highway with its recording pads under it, one per column, and its practice controls beside it,
  // in either layout. Arm recording and play: each pad tap - or its key, 1 to 5 and on through the letters
  // for more columns - drops a projectile in that column, snapped. Pausing ends the take. While armed, a
  // column's key taps it rather than running its shortcut, so it listens before App does (capture).
  import { grow } from "./motion";
  import { HIGHWAY_COLUMNS_RANGE, templateAs } from "../model/columns";
  import { STRUCTURES } from "../model/constants";
  import type { Structure } from "../model/types";
  import { doc } from "../store/document.svelte";
  import { editing } from "../store/editing.svelte";
  import { display } from "../store/display.svelte";
  import Icon from "./Icon.svelte";
  import { untrack } from "svelte";
  import { transport } from "../store/transport.svelte";
  import { commandButton } from "../store/commands";
  import { loopPointLabel, practice } from "../store/practice.svelte";
  import { RECORD_KEYS, recording, type RecordMode } from "../store/recording.svelte";
  import Highway from "../views/highway/Highway.svelte";
  import { highwayColumns } from "../views/highway/geometry";
  import Minimap from "./Minimap.svelte";

  const columns = $derived(highwayColumns(display.highwayColumns));

  // A take ends when playing stops, and when the highway goes away.
  $effect(() => { if (!transport.playing) untrack(() => recording.finish()); });
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
    const index = RECORD_KEYS.indexOf(ev.key.toLowerCase());
    if (index < 0 || index >= columns.length) return;
    ev.preventDefault();
    hit(index);
  }

  const MODES: [RecordMode, string][] = [["add", "Add"], ["replace", "Replace"]];
</script>

<svelte:window onkeydowncapture={key} />

<div class="screen">
  <div class="road">
    <div class="canvasbox"><Highway loop={practice.loop} /></div>
    {#if recording.armed}
      <div class="pads" in:grow out:grow style:grid-template-columns="repeat({columns.length}, minmax(0, 1fr))">
        {#each columns as column, index (index)}
          <button class="pad" aria-label="Tap {column.label}" aria-keyshortcuts={RECORD_KEYS[index]} bind:this={pads[index]}
            onpointerdown={ev => { ev.preventDefault(); hit(index); }}><kbd>{RECORD_KEYS[index].toUpperCase()}</kbd></button>
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
      <div class="count" aria-live="polite">{recording.count ? `${recording.count} in take` : transport.playing ? "Tap along" : "Play to record"}</div>
    {/if}
    <div class="pair">
      <button aria-label="Back a bar" {...commandButton("back-bar")}>−bar</button>
      <button aria-label="Back 5 seconds" {...commandButton("back-5s")}>−5s</button>
    </div>
    <button {...commandButton("last-play")}><Icon name="back" /> Last play</button>
    <button class:on={practice.loopStart != null} {...commandButton("loop")}>{loopPointLabel()}</button>
    <button {...commandButton("preroll")}>Pre-roll</button>
    <label class="columns" title="What a pad, key or tap adds: pick a structure, or select a projectile and press Like selected to copy it whole">
      <span>Places</span>
      <select value={editing.newProjectile?.structure ?? ""}
        onchange={ev => { const s = ev.currentTarget.value; editing.placeLike(s ? templateAs(doc.chart, editing.newProjectile, s as Structure) : null); }}>
        <option value="">Default</option>
        {#each STRUCTURES as s (s)}<option value={s}>{s}</option>{/each}
      </select>
    </label>
    <button {...commandButton("place-like-selected")}>Like selected</button>
    <label class="columns" title="How many columns the highway has, each with a pad and a key ({HIGHWAY_COLUMNS_RANGE[0]} to {HIGHWAY_COLUMNS_RANGE[1]})">
      <span>Columns</span>
      <input type="number" min={HIGHWAY_COLUMNS_RANGE[0]} max={HIGHWAY_COLUMNS_RANGE[1]} step="1" value={display.highwayColumns}
        onchange={ev => { display.setHighwayColumns(+ev.currentTarget.value); ev.currentTarget.value = String(display.highwayColumns); }} />
    </label>
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
    background: color-mix(in srgb, var(--accent) 14%, var(--raised)); touch-action: none; transition: background-color 160ms ease-out;
  }
  .pad:global(.hit) { background: var(--accent); transition: none; }
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
  .columns { display: grid; gap: 2px; font-size: 12px; color: var(--text-dim); text-align: center; }
  .columns input, .columns select { width: 100%; min-width: 0; text-align: center; }

  :global(.shell.portrait) .screen { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto; }
  :global(.shell.portrait) .controls { flex-direction: row; flex-wrap: wrap; border-left: 0; border-top: 1px solid var(--line); }
  :global(.shell.portrait) .modes { grid-auto-flow: column; }
  :global(.shell.portrait) .controls :global(.map) { display: none; }
</style>
