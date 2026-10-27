<script lang="ts">
  // A long press on a projectile (the timeline's markers, the highway's tiles) opens these for the
  // selection, just above the finger: what a right-click menu would hold. A tap anywhere else only
  // closes it - it doesn't also reach what was tapped.
  import { commandButton } from "../store/commands";
  import { editor } from "../store/editor.svelte";
  import { drop, veil } from "./motion";

  let w = $state(0), h = $state(0);
  const ACTIONS: [id: string, label: string][] = [["copy", "Copy"], ["mirror", "Mirror"], ["delete", "Delete"]];
  const count = $derived(editor.selection.size);

  // Above the finger, so the finger doesn't hide it; below it if there's no room; never off screen.
  const place = $derived.by(() => {
    const at = editor.quickActions ?? { x: 0, y: 0 }, margin = 8;
    const left = Math.min(Math.max(margin, at.x - w / 2), window.innerWidth - w - margin);
    const above = at.y - h - 20;
    return { left, top: above >= margin ? above : Math.min(at.y + 28, window.innerHeight - h - margin) };
  });

  // Nothing left to act on (undone, deleted elsewhere): close.
  $effect(() => { if (!count) editor.quickActions = null; });

  function run(id: string): void {
    commandButton(id).onclick();
    editor.quickActions = null;
  }

  /** A press outside closes it, and goes no further. */
  function outside(ev: PointerEvent): void {
    if ((ev.target as Element).closest?.(".quick")) return;
    ev.stopPropagation();
    editor.quickActions = null;
  }
</script>

<svelte:window onpointerdowncapture={outside} onkeydown={ev => { if (ev.key === "Escape") editor.quickActions = null; }} />

<div class="quick" role="menu" aria-label="{count} selected" style:left="{place.left}px" style:top="{place.top}px"
  bind:clientWidth={w} bind:clientHeight={h} in:drop out:veil>
  <span class="count">{count} selected</span>
  {#each ACTIONS as [id, label] (id)}
    <button role="menuitem" class:danger={id === "delete"} {...commandButton(id)} onclick={() => run(id)}>{label}</button>
  {/each}
</div>

<style>
  .quick {
    position: fixed; z-index: 25; display: flex; align-items: center; gap: 4px; padding: 4px;
    background: var(--panel); border: 1px solid var(--line); border-radius: 10px; box-shadow: 0 8px 24px var(--shadow);
  }
  .count { font-size: 12px; color: var(--text-dim); padding: 0 6px; white-space: nowrap; }
  button { min-height: 40px; }
  .danger { color: var(--bad); border-color: color-mix(in srgb, var(--bad) 45%, transparent); }
</style>
