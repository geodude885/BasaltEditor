<script lang="ts">
  import { session } from "../../store/session.svelte";
</script>

<div class="problems">
  {#each session.problems as problem, i (i)}
    <div>{problem}</div>
  {:else}
    <div class="none">No problems found.</div>
  {/each}
</div>

<style>
  .problems { display: grid; gap: 4px; font: 13px var(--mono); }
  .problems div { padding: 4px 8px; border-left: 3px solid var(--bad); background: color-mix(in srgb, var(--bad) 8%, transparent); }
  .problems .none { border-left-color: var(--good); background: color-mix(in srgb, var(--good) 8%, transparent); }
</style>
