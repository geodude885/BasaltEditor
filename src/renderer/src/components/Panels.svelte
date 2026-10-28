<script lang="ts">
  // The desktop's settings: a tab bar, and the open tab's panel. The tabs are in panels/tabs.ts.
  import { ui } from "../store/ui.svelte";
  import { PANEL_TABS, TAB_ORDER } from "./panels/tabs";

  const Panel = $derived(PANEL_TABS[ui.tab].panel);
</script>

<div class="tabs">
  <div class="tabbar" role="tablist">
    {#each TAB_ORDER as id (id)}
      <button role="tab" aria-selected={ui.tab === id} onclick={() => { ui.tab = id; }}>{PANEL_TABS[id].label}</button>
    {/each}
  </div>
  <div class="panel" role="tabpanel">
    <Panel />
  </div>
</div>

<style>
  .tabs { display: flex; flex-direction: column; min-height: 0; }
  .tabbar { display: flex; flex-wrap: wrap; gap: 2px; padding: 6px 8px 0; border-bottom: 1px solid var(--line); }
  .tabbar button {
    border: 0; border-radius: 6px 6px 0 0; background: none; color: var(--text-dim); padding: 6px 12px;
    font: 600 14px var(--display); letter-spacing: .06em; text-transform: uppercase;
  }
  .tabbar button[aria-selected="true"] { background: var(--raised); color: var(--text); }
  .panel { padding: 12px; overflow: auto; display: grid; gap: 12px; align-content: start; }
</style>
