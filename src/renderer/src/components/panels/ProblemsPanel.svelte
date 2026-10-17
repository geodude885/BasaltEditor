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
  .problems div { padding: 4px 8px; border-left: 3px solid var(--bad); background: #ff5a5a14; }
  .problems .none { border-left-color: var(--good); background: #4fd1a514; }
</style>
