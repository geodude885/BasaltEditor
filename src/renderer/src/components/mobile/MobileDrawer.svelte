<script lang="ts">
  // The phone layout's settings: a rail of tabs, and the open tab's panel in a drawer over the editor.
  import { dismissable } from "../gestures";
  import { layout } from "../../store/layout.svelte";
  import { panel, type Side } from "../motion";
  import Icon from "../Icon.svelte";
  import { mobile } from "../../store/mobile.svelte";
  import type { Tab } from "../../store/ui.svelte";
  import { PANEL_TABS, TAB_ORDER } from "../panels/tabs";

  let { part }: { part: "rail" | "drawer" } = $props();

  const side = $derived<Side>(layout.landscape ? "left" : "bottom");
  const close = () => { mobile.drawer = null; };
  // The open tab - or, while the drawer slides shut, the one it's closing on.
  let last: Tab = "chart";
  const open = $derived.by(() => { if (mobile.drawer) last = mobile.drawer; return PANEL_TABS[last]; });
  const Panel = $derived(open.panel);
</script>

{#if part === "rail"}
  <nav class="rail" aria-label="Settings">
    {#each TAB_ORDER as id (id)}
      <button aria-pressed={mobile.drawer === id} class:on={mobile.drawer === id} onclick={() => mobile.toggleDrawer(id)}>{PANEL_TABS[id].short}</button>
    {/each}
  </nav>
{:else if mobile.drawer}
  <!-- Drag it back the way it came to close it: sideways in landscape, down by its header in portrait. -->
  <section class="drawer" aria-label={open.label} in:panel={{ from: side }} out:panel={{ from: side }}
    use:dismissable={side === "left"
      ? { axis: "x", toward: -1, onClose: close }
      : { axis: "y", toward: 1, handle: "header", onClose: close }}>
    <header><h3>{open.label}</h3><button aria-label="Close" onclick={() => { mobile.drawer = null; }}><Icon name="close" /></button></header>
    <div class="panel">
      <Panel />
    </div>
  </section>
{/if}

<style>
  .rail { display: flex; flex-direction: column; gap: 2px; padding: 4px; overflow: auto; background: var(--panel); border-right: 1px solid var(--line); touch-action: pan-y; }
  .rail button {
    border: 0; background: none; color: var(--text-dim); padding: 0 2px; min-height: 40px; flex: 1 0 40px;
    font: 600 12px var(--display); letter-spacing: .04em; text-transform: uppercase; white-space: normal;
  }
  .rail button.on { background: var(--raised); color: var(--accent); }
  .drawer {
    position: absolute; z-index: 4; top: 0; left: 0; bottom: 0; width: min(440px, 75%); display: flex; flex-direction: column;
    background: var(--panel); border-right: 1px solid var(--line);
    touch-action: pan-y;
  }
  header { display: flex; align-items: center; justify-content: space-between; padding: 4px 6px 4px 12px; border-bottom: 1px solid var(--line); touch-action: none; }
  header button { min-width: 40px; min-height: 40px; }
  .panel { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 12px; display: grid; gap: 12px; align-content: start; touch-action: pan-y; }

  /* Portrait: the rail runs along the bottom, and the drawer rises from it. */
  :global(.shell.portrait) .rail { flex-direction: row; border-right: 0; border-top: 1px solid var(--line); }
  :global(.shell.portrait) .rail button { flex: 1 1 0; min-width: 0; font-size: 11px; }
  :global(.shell.portrait) .drawer { top: auto; right: 0; width: auto; height: 62%; border-right: 0; border-top: 1px solid var(--line); }
</style>
