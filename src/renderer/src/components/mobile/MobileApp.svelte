<script lang="ts">
  // The phone layout: a fixed shell that fills the screen and never scrolls as a page, so a finger on
  // the editor always reaches the editor. Landscape first - the lane beside the timeline - with
  // portrait stacking the same pieces. Settings open in a drawer from the rail; the selected event's
  // fields float over the lane.
  import { untrack } from "svelte";
  import { dismissable, edgeSwipe } from "../gestures";
  import { library } from "../../store/library.svelte";
  import { rise, type Side } from "../motion";
  import { display } from "../../store/display.svelte";
  import { editing } from "../../store/editing.svelte";
  import { ui } from "../../store/ui.svelte";
  import { layout } from "../../store/layout.svelte";
  import { mobile } from "../../store/mobile.svelte";
  import LaneView from "../../views/lane/LaneView.svelte";
  import Timeline from "../../views/timeline/Timeline.svelte";
  import Inspector from "../Inspector.svelte";
  import LookPreview from "../LookPreview.svelte";
  import HighwayScreen from "../HighwayScreen.svelte";
  import MenuSheet from "./MenuSheet.svelte";
  import MobileBar from "./MobileBar.svelte";
  import MobileDrawer from "./MobileDrawer.svelte";
  import SelectionBar from "./SelectionBar.svelte";

  // The page itself stops scrolling and bouncing while this layout is up.
  $effect(() => {
    document.documentElement.classList.add("compact");
    return () => document.documentElement.classList.remove("compact");
  });

  // Shared code asking for a settings tab (ui.revealTab): open the drawer on it, over the menu.
  // Only requests made from now on: one from before this layout showed has been answered.
  let answered = ui.tabRevealed;
  $effect(() => {
    const asked = ui.tabRevealed;
    if (asked === answered) return;
    answered = asked;
    untrack(() => { mobile.drawer = ui.tab; mobile.menu = false; });
  });

  const floatSide = $derived<Side>(layout.landscape ? "left" : "bottom");
  const inspecting = $derived(editing.selection.size > 0 && !mobile.drawer);
</script>

<!-- A swipe in from the left edge (or across the rail) opens the menu. -->
<div class="shell" class:portrait={!layout.landscape}
  use:edgeSwipe={{ onOpen: () => { mobile.drawer = null; mobile.menu = true; }, disabled: mobile.menu || library.visible }}>
  <div class="bar"><MobileBar /></div>
  <div class="rail" data-swipe-open><MobileDrawer part="rail" /></div>
  <main class="main">
    <div class="lanebox"><LaneView /></div>
    {#if display.mainView === "highway"}
      <div class="highwaybox"><HighwayScreen /></div>
    {:else}
      <div class="timebox"><Timeline /></div>
    {/if}
    {#if inspecting}
      <!-- Flick it aside to let go of the selection. -->
      <aside class="float" aria-label="Selected" in:rise={{ from: floatSide }} out:rise={{ from: floatSide }}
        use:dismissable={{ axis: "x", toward: layout.landscape ? -1 : 0, onClose: () => editing.selection.clear() }}>
        <Inspector />
      </aside>
    {/if}
    <MobileDrawer part="drawer" />
  </main>
  <div class="tools"><SelectionBar /></div>
  {#if display.lookPreview}<LookPreview />{/if}
  {#if mobile.menu}<MenuSheet />{/if}
</div>

<style>
  :global(html.compact), :global(html.compact body) { height: 100dvh; overflow: hidden; overscroll-behavior: none; }
  :global(html.compact body) { position: fixed; inset: 0; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
  :global(html.compact input), :global(html.compact textarea) { -webkit-user-select: text; user-select: text; }

  /*
   * The phone's notch, status bar and home indicator: the whole shell keeps clear of them (the screen's
   * "safe area", zero where there is nothing in the way), in the panel colour so the edges blend in.
   * The menu sheet, absolutely placed over the shell, pads itself.
   */
  .shell {
    position: relative; height: 100dvh; display: grid; overflow: hidden; background: var(--panel);
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
    grid-template-columns: 64px minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr) auto;
    grid-template-areas: "bar bar" "rail main" "rail tools";
  }
  .bar { grid-area: bar; min-width: 0; }
  /*
   * Where a swipe from the left edge can start, the browser may only scroll up and down - otherwise
   * it claims a sideways drag as a scroll and the swipe never reaches components/gestures.ts. The
   * bars that scroll sideways keep that, so the swipe doesn't start on them.
   */
  .rail, .lanebox, .timebox :global(.row-headers) { touch-action: pan-y; }
  .rail { grid-area: rail; min-height: 0; display: flex; flex-direction: column; background: var(--panel); }
  .rail > :global(*) { flex: 1; }
  .tools { grid-area: tools; min-width: 0; }
  .main {
    grid-area: main; position: relative; min-height: 0; min-width: 0; display: grid; overflow: hidden;
    grid-template-columns: minmax(140px, 30%) minmax(0, 1fr);
  }
  .lanebox { min-height: 0; min-width: 0; display: flex; align-items: center; justify-content: center; border-right: 1px solid var(--line); background: var(--bg); }
  .lanebox :global(canvas) { height: 100%; width: auto; max-width: 100%; aspect-ratio: 3 / 4; }
  .timebox { min-height: 0; min-width: 0; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; background: var(--panel); }
  .highwaybox { min-height: 0; min-width: 0; position: relative; }
  .timebox :global(.timeline) { grid-template-columns: 76px minmax(0, 1fr); }
  .float {
    position: absolute; z-index: 3; left: 6px; bottom: 6px; top: 6px; width: min(340px, 46%); overflow: auto; overscroll-behavior: contain;
    background: var(--panel); border: 1px solid var(--line); border-radius: 10px; touch-action: pan-y;
  }
  .float :global(.inspector) { border-top: 0; }

  /* Portrait: timeline on top, a small lane under it, the rail along the bottom. */
  .shell.portrait {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr) auto auto;
    grid-template-areas: "bar" "main" "tools" "rail";
  }
  .shell.portrait .main { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) minmax(120px, 34%); }
  .shell.portrait .lanebox { order: 2; border-right: 0; border-top: 1px solid var(--line); }
  .shell.portrait .float { top: auto; width: auto; right: 6px; max-height: 55%; }
</style>
