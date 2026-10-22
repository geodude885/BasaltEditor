<script lang="ts">
  // The phone layout's edit buttons - the shortcuts a keyboard would give. What they offer follows the
  // selection: adding with nothing selected, editing what is.
  import { PROJECTILE_COLUMNS } from "../../model/columns";
  import { addMove, addPhase, addProjectileInColumn, addStageCueAtPlayhead, copySelected, mirrorSelected, paste, removeSelected } from "../../store/actions";
  import { editor } from "../../store/editor.svelte";

  const count = $derived(editor.selection.size);
</script>

<div class="tools">
  <button class:on={editor.multiSelect} aria-pressed={editor.multiSelect} onclick={() => { editor.multiSelect = !editor.multiSelect; }}>Multi</button>
  {#if count}
    <span class="count">{count} selected</span>
    <button onclick={copySelected}>Copy</button>
    <button onclick={mirrorSelected}>Mirror</button>
    <button class="danger" onclick={removeSelected}>Delete</button>
    <button onclick={() => { editor.selection.clear(); }}>Done</button>
  {:else}
    <button onclick={() => addProjectileInColumn(editor.time, Math.floor(PROJECTILE_COLUMNS / 2))}>+ Projectile</button>
    <button onclick={addMove}>+ Move</button>
    <button onclick={addStageCueAtPlayhead}>+ Look</button>
    <button onclick={addPhase}>+ Phase</button>
    <button onclick={paste}>Paste</button>
  {/if}
</div>

<style>
  .tools {
    display: flex; gap: 6px; align-items: center; padding: 4px 8px; overflow-x: auto; overscroll-behavior: contain;
    border-top: 1px solid var(--line); background: var(--panel); padding-right: max(8px, env(safe-area-inset-right));
  }
  button { min-height: 38px; flex: none; }
  .count { color: var(--text-dim); font-size: 12px; white-space: nowrap; }
  .danger { color: var(--bad); border-color: color-mix(in srgb, var(--bad) 45%, transparent); }
</style>
