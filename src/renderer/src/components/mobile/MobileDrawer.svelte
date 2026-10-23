<script lang="ts">
  // The phone layout's settings: a rail of tabs, and the open tab's panel in a drawer over the editor.
  import Icon from "../Icon.svelte";
  import type { Tab } from "../../store/editor.svelte";
  import { mobile } from "../../store/mobile.svelte";
  import ActorsPanel from "../panels/ActorsPanel.svelte";
  import ChartPanel from "../panels/ChartPanel.svelte";
  import HelpPanel from "../panels/HelpPanel.svelte";
  import LooksPanel from "../panels/LooksPanel.svelte";
  import PhasesPanel from "../panels/PhasesPanel.svelte";
  import ProblemsPanel from "../panels/ProblemsPanel.svelte";
  import TempoPanel from "../panels/TempoPanel.svelte";

  let { part }: { part: "rail" | "drawer" } = $props();

  const TABS: [Tab, string][] = [
    ["chart", "Chart"], ["phases", "Phases"], ["looks", "Looks"], ["tempo", "Tempo"], ["actors", "Actors"], ["problems", "Issues"], ["help", "Help"],
  ];
  const title = $derived(TABS.find(([id]) => id === mobile.drawer)?.[1] ?? "");
</script>

{#if part === "rail"}
  <nav class="rail" aria-label="Settings">
    {#each TABS as [id, label] (id)}
      <button aria-pressed={mobile.drawer === id} class:on={mobile.drawer === id} onclick={() => mobile.toggleDrawer(id)}>{label}</button>
    {/each}
  </nav>
{:else if mobile.drawer}
  <section class="drawer" aria-label={title}>
    <header><h3>{title}</h3><button aria-label="Close" onclick={() => { mobile.drawer = null; }}><Icon name="close" /></button></header>
    <div class="panel">
      {#if mobile.drawer === "chart"}<ChartPanel />
      {:else if mobile.drawer === "phases"}<PhasesPanel />
      {:else if mobile.drawer === "looks"}<LooksPanel />
      {:else if mobile.drawer === "tempo"}<TempoPanel />
      {:else if mobile.drawer === "actors"}<ActorsPanel />
      {:else if mobile.drawer === "problems"}<ProblemsPanel />
      {:else}<HelpPanel />{/if}
    </div>
  </section>
{/if}

<style>
  .rail { display: flex; flex-direction: column; gap: 2px; padding: 4px; overflow: auto; background: var(--panel); border-right: 1px solid var(--line); }
  .rail button {
    border: 0; background: none; color: var(--text-dim); padding: 0 2px; min-height: 40px; flex: 1 0 40px;
    font: 600 12px var(--display); letter-spacing: .04em; text-transform: uppercase; white-space: normal;
  }
  .rail button.on { background: var(--raised); color: var(--accent); }
  .drawer {
    position: absolute; z-index: 4; top: 0; left: 0; bottom: 0; width: min(440px, 75%); display: flex; flex-direction: column;
    background: var(--panel); border-right: 1px solid var(--line);
  }
  header { display: flex; align-items: center; justify-content: space-between; padding: 4px 6px 4px 12px; border-bottom: 1px solid var(--line); }
  header button { min-width: 40px; min-height: 40px; }
  .panel { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 12px; display: grid; gap: 12px; align-content: start; }

  /* Portrait: the rail runs along the bottom, and the drawer rises from it. */
  :global(.shell.portrait) .rail { flex-direction: row; border-right: 0; border-top: 1px solid var(--line); }
  :global(.shell.portrait) .rail button { flex: 1 1 0; min-width: 0; font-size: 11px; }
  :global(.shell.portrait) .drawer { top: auto; right: 0; width: auto; height: 62%; border-right: 0; border-top: 1px solid var(--line); }
</style>
