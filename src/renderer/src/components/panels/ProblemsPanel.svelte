<script lang="ts">
  import { editor } from "../../store/editor.svelte";
</script>

<div class="problems">
  {#each editor.problems as problem, i (i)}
    <div>{problem}</div>
  {:else}
    <div class="none">No problems - the mod will load this chart.</div>
  {/each}
</div>

<style>
  .problems { display: grid; gap: 4px; font: 13px var(--mono); }
  .problems div { padding: 4px 8px; border-left: 3px solid var(--bad); background: color-mix(in srgb, var(--bad) 8%, transparent); }
  .problems .none { border-left-color: var(--good); background: color-mix(in srgb, var(--good) 8%, transparent); }
</style>
