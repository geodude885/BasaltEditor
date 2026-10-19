<script lang="ts">
  import { phaseTime } from "../../model/chart";
  import { round } from "../../model/tempo";
  import { addPhase, selectPhase } from "../../store/actions";
  import { doc } from "../../store/document.svelte";
  import { editor } from "../../store/editor.svelte";
  import { seek } from "../../store/playback";
  import PhaseEditor from "./PhaseEditor.svelte";

  const phases = $derived(doc.chart.phases ?? []);
  const selected = $derived(phases[editor.selectedPhase]);
</script>

<div class="row">
  <button class="primary" title="Start a phase at the playhead" onclick={addPhase}>+ Phase at the playhead</button>
  <span class="note">Phases split the battle into sections: each can score hits differently, move an actor and recolour the lane.</span>
</div>

{#if phases.length}
  <div class="phases" role="listbox" aria-label="Phases">
    {#each phases as phase, i (i)}
      <button role="option" aria-selected={i === editor.selectedPhase} onclick={() => { selectPhase(i); seek(phaseTime(phase, doc.tempo)); }}>
        <b>{phase.name || `Phase ${i + 1}`}</b>
        <span>{round(phaseTime(phase, doc.tempo), 2)} s{phase.scoreMultiplier && phase.scoreMultiplier !== 1 ? ` · ×${phase.scoreMultiplier}` : ""}</span>
      </button>
    {/each}
  </div>
{:else}
  <div class="note">No phases: the whole battle is one section. Add one at the playhead, or click the timeline's phase row.</div>
{/if}

{#if selected}<PhaseEditor phase={selected} index={editor.selectedPhase} />{/if}

<style>
  .phases { display: flex; flex-wrap: wrap; gap: 6px; }
  .phases button { display: grid; gap: 1px; text-align: left; font-size: 12px; padding: 4px 8px; border-left: 3px solid var(--phase); }
  .phases button span { color: var(--dust); }
  .phases button[aria-selected="true"] { border-color: var(--phase); background: #4fd1a522; }
</style>
