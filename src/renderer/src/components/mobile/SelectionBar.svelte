<script lang="ts">
  // The phone layout's edit buttons - the shortcuts a keyboard would give, as commands from
  // store/commands.ts. What they offer follows the selection: adding with nothing selected, editing what is.
  import { grow } from "../motion";
  import { PROJECTILE_COLUMNS } from "../../model/columns";
  import { addProjectileInColumn } from "../../store/actions";
  import { commandButton } from "../../store/commands";
  import { editing } from "../../store/editing.svelte";
  import { transport } from "../../store/transport.svelte";
  import { practice } from "../../store/practice.svelte";

  const count = $derived(editing.selection.size);
</script>

<div class="tools">
  <button {...commandButton("select-mode")}>Select</button>
  <button {...commandButton("multi-select")}>Multi</button>
  {#if editing.selectMode}
    <!-- Whole sections at once: the projectiles in the bar at the playhead, the loop, the rest, or all. -->
    <span class="group" role="group" aria-label="Select projectiles" in:grow={{ axis: "x" }} out:grow={{ axis: "x" }}>
      <button {...commandButton("select-bar")}>Bar</button>
      {#if practice.loop}<button {...commandButton("select-loop")}>Loop</button>{/if}
      <button {...commandButton("select-to-end")}>To end</button>
      <button {...commandButton("select-all")}>All</button>
    </span>
  {/if}
  {#if count}
    <span class="count">{count} selected</span>
    <button {...commandButton("copy")}>Copy</button>
    <button {...commandButton("mirror")}>Mirror</button>
    <button class="danger" {...commandButton("delete")}>Delete</button>
    <button {...commandButton("select-none")}>Done</button>
  {:else}
    <!-- In the middle column, as a tap on the highway's middle would add it. -->
    <button onclick={() => addProjectileInColumn(transport.time, Math.floor(PROJECTILE_COLUMNS / 2))}>+ Projectile</button>
    <button {...commandButton("add-move")}>+ Move</button>
    <button {...commandButton("add-look")}>+ Look</button>
    <button {...commandButton("add-phase")}>+ Phase</button>
    <button {...commandButton("paste")}>Paste</button>
  {/if}
</div>

<style>
  .tools {
    display: flex; gap: 6px; align-items: center; padding: 4px 8px; overflow-x: auto; overscroll-behavior: contain;
    border-top: 1px solid var(--line); background: var(--panel);
  }
  button { min-height: 38px; flex: none; }
  .group { display: flex; gap: 2px; padding: 0 4px; border-left: 1px solid var(--line); border-right: 1px solid var(--line); flex: none; }
  .group button { min-width: 44px; }
  .count { color: var(--text-dim); font-size: 12px; white-space: nowrap; }
  .danger { color: var(--bad); border-color: color-mix(in srgb, var(--bad) 45%, transparent); }
</style>
