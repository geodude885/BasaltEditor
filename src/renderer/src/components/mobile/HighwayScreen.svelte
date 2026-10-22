<script lang="ts">
  // The highway with its recording pads under it, one per column, and its controls beside it. Arm
  // recording and play: each pad tap drops a projectile in that column, snapped. Pausing ends the take.
  import { untrack } from "svelte";
  import { editor } from "../../store/editor.svelte";
  import { recording, type RecordMode } from "../../store/recording.svelte";
  import Highway from "../../views/highway/Highway.svelte";
  import { highwayColumns } from "../../views/highway/geometry";

  const columns = highwayColumns();

  // A take ends when playing stops, and when the highway goes away.
  $effect(() => { if (!editor.playing) untrack(() => recording.finish()); });
  $effect(() => () => recording.finish());

  function pad(ev: PointerEvent, index: number): void {
    ev.preventDefault();
    const column = columns[index];
    if (column.kind === "projectile") recording.hit(column.column);
    navigator.vibrate?.(8);
    const el = ev.currentTarget as HTMLElement;
    el.classList.add("hit");
    setTimeout(() => el.classList.remove("hit"), 110);
  }

  const MODES: [RecordMode, string][] = [["add", "Add"], ["replace", "Replace"]];
</script>

<div class="screen">
  <div class="road">
    <div class="canvasbox"><Highway /></div>
    {#if recording.armed}
      <div class="pads" style:grid-template-columns="repeat({columns.length}, minmax(0, 1fr))">
        {#each columns as column, index (index)}
          <button class="pad" aria-label="Tap {column.label}" onpointerdown={ev => pad(ev, index)}></button>
        {/each}
      </div>
    {/if}
  </div>
  <div class="controls">
    <button class="rec" class:on={recording.armed} aria-pressed={recording.armed}
      onclick={() => { recording.finish(); recording.armed = !recording.armed; }}>● Rec</button>
    {#if recording.armed}
      <div class="modes" role="group" aria-label="Recording mode">
        {#each MODES as [mode, label] (mode)}
          <button class:on={recording.mode === mode} aria-pressed={recording.mode === mode} onclick={() => { recording.mode = mode; }}>{label}</button>
        {/each}
      </div>
      <div class="count" aria-live="polite">{recording.count ? `${recording.count} in take` : editor.playing ? "Tap along" : "Play to record"}</div>
    {/if}
  </div>
</div>

<style>
  .screen { height: 100%; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 84px; }
  .road { min-height: 0; min-width: 0; display: flex; flex-direction: column; }
  .canvasbox { flex: 1; min-height: 0; position: relative; }
  .pads { display: grid; gap: 4px; padding: 4px; height: 64px; flex: none; background: var(--panel); border-top: 1px solid var(--line); }
  .pad {
    border-radius: 8px; border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent); padding: 0;
    background: color-mix(in srgb, var(--accent) 14%, var(--raised)); touch-action: none;
  }
  .pad:global(.hit) { background: var(--accent); }
  .controls {
    display: flex; flex-direction: column; gap: 6px; padding: 6px; border-left: 1px solid var(--line); background: var(--panel);
    overflow-y: auto; overscroll-behavior: contain; padding-right: max(6px, env(safe-area-inset-right));
  }
  .controls button { min-height: 40px; white-space: normal; padding: 4px; }
  .rec.on { background: var(--bad); border-color: var(--bad); color: var(--on-accent); }
  .modes { display: grid; gap: 2px; }
  .count { font-size: 12px; color: var(--text-dim); text-align: center; }

  :global(.shell.portrait) .screen { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto; }
  :global(.shell.portrait) .controls { flex-direction: row; flex-wrap: wrap; border-left: 0; border-top: 1px solid var(--line); }
  :global(.shell.portrait) .modes { grid-auto-flow: column; }
</style>
