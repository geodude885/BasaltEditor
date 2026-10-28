<script lang="ts">
  // What the projectile colours mean (View > Projectile colours), for the structures this chart throws.
  import { doc } from "../store/document.svelte";
  import { display } from "../store/display.svelte";
  import { shotLegend } from "../views/shotColours";

  const entries = $derived(shotLegend(doc.chart, display.shotColouring));
</script>

{#if entries.length}
  <ul class="legend" aria-label="Projectile colours">
    {#each entries as entry (entry.label)}
      <li><span class="chip" class:striped={entry.striped} style:--chip="var({entry.colourVariable})"></span>{entry.label}</li>
    {/each}
  </ul>
{/if}

<style>
  .legend { display: flex; flex-wrap: wrap; gap: 4px 10px; margin: 0; padding: 4px 12px 6px; list-style: none; font-size: 11px; color: var(--text-dim); }
  li { display: flex; align-items: center; gap: 4px; }
  .chip { width: 10px; height: 10px; border-radius: 2px; background: var(--chip); }
  .chip.striped {
    background: repeating-linear-gradient(-45deg, var(--chip) 0 2px, color-mix(in srgb, var(--floor) 80%, var(--chip)) 2px 4px);
  }
</style>
