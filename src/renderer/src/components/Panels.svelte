<script lang="ts">
  import { editor, type Tab } from "../store/editor.svelte";
  import ActorsPanel from "./panels/ActorsPanel.svelte";
  import ChartPanel from "./panels/ChartPanel.svelte";
  import HelpPanel from "./panels/HelpPanel.svelte";
  import ProblemsPanel from "./panels/ProblemsPanel.svelte";
  import TempoPanel from "./panels/TempoPanel.svelte";

  const tabs: [Tab, string][] = [["chart", "Chart"], ["tempo", "Tempo"], ["actors", "Actors"], ["problems", "Problems"], ["help", "Keys & help"]];
</script>

<div class="tabs">
  <div class="tabbar" role="tablist">
    {#each tabs as [id, label] (id)}
      <button role="tab" aria-selected={editor.tab === id} onclick={() => { editor.tab = id; }}>{label}</button>
    {/each}
  </div>
  <div class="panel" role="tabpanel">
    {#if editor.tab === "chart"}<ChartPanel />
    {:else if editor.tab === "tempo"}<TempoPanel />
    {:else if editor.tab === "actors"}<ActorsPanel />
    {:else if editor.tab === "problems"}<ProblemsPanel />
    {:else}<HelpPanel />{/if}
  </div>
</div>

<style>
  .tabs { display: flex; flex-direction: column; min-height: 0; }
  .tabbar { display: flex; flex-wrap: wrap; gap: 2px; padding: 6px 8px 0; border-bottom: 1px solid var(--line); }
  .tabbar button {
    border: 0; border-radius: 6px 6px 0 0; background: none; color: var(--dust); padding: 6px 12px;
    font: 600 14px var(--display); letter-spacing: .06em; text-transform: uppercase;
  }
  .tabbar button[aria-selected="true"] { background: var(--slab-2); color: var(--sand); }
  .panel { padding: 12px; overflow: auto; display: grid; gap: 12px; align-content: start; }
</style>
