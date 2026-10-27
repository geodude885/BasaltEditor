<script lang="ts">
  import { dismissable } from "./components/gestures";
  import { rise, type Side } from "./components/motion";
  import { onMount } from "svelte";
  import Inspector from "./components/Inspector.svelte";
  import Panels from "./components/Panels.svelte";
  import TopBar from "./components/TopBar.svelte";
  import Transport from "./components/Transport.svelte";
  import HighwayScreen from "./components/HighwayScreen.svelte";
  import LookPreview from "./components/LookPreview.svelte";
  import ShotLegend from "./components/ShotLegend.svelte";
  import MobileApp from "./components/mobile/MobileApp.svelte";
  import Library from "./components/library/Library.svelte";
  import { library } from "./store/library.svelte";
  import { SAMPLE } from "./model/samples";
  import { fit, loadChart, toast } from "./store/actions";
  import { doc, restoreDraft } from "./store/document.svelte";
  import { editor } from "./store/editor.svelte";
  import { openDropped } from "./store/files";
  import { handleShortcut } from "./store/keyboard";
  import { layout } from "./store/layout.svelte";
  import { keepLooping } from "./store/practice.svelte";
  import LaneView from "./views/lane/LaneView.svelte";
  import Timeline from "./views/timeline/Timeline.svelte";

  // Start: the last draft, else the sample chart.
  const draft = restoreDraft();
  loadChart(draft?.text ?? SAMPLE, draft?.name ?? "Crossfire (example)");

  onMount(() => {
    // Fit the timeline again once the page has its real size.
    requestAnimationFrame(() => requestAnimationFrame(fit));
    if (!draft) toast("This is an example chart. Open your own, or press New");
  });

  // Keep an A-B loop going round, in either layout and whichever editor is showing.
  $effect(() => { void editor.time; keepLooping(); });

  $effect(() => { document.title = `${doc.dirty ? "• " : ""}${doc.chart.name || "Untitled"} - Basalt Editor`; });

  // Drop files anywhere. The hint shows only while files are being dragged over the window: every
  // dragover keeps it up, and it goes a moment after they stop (a cancelled drag sends no reliable "leave").
  let dropping = $state(false), dropTimer = 0;
  function dragover(ev: DragEvent): void {
    if (!ev.dataTransfer?.types.includes("Files")) return;
    ev.preventDefault();
    dropping = true;
    clearTimeout(dropTimer);
    dropTimer = window.setTimeout(() => { dropping = false; }, 250);
  }
  function drop(ev: DragEvent): void {
    ev.preventDefault();
    dropping = false;
    const files = [...(ev.dataTransfer?.files ?? [])];
    if (files.length) void openDropped(files);
  }
  // Where toasts come from: below on the desktop, from the top bar on a phone.
  const toastFrom = $derived<Side>(layout.compact ? "top" : "bottom");
</script>

<svelte:window onkeydown={handleShortcut} ondragover={dragover} ondrop={drop} onblur={() => { dropping = false; }} />

{#if layout.compact}
<MobileApp />
{:else}
<div class="app">
  <TopBar />
  <main class="work">
    <section class="pane lanepane" aria-label="Lane">
      <h2>Lane from above</h2>
      <LaneView />
      <ShotLegend />
      <Inspector />
    </section>
    <section class="pane timepane" class:highway={editor.mainView === "highway"} aria-label={editor.mainView === "highway" ? "Highway" : "Timeline"}>
      <Transport />
      {#if editor.mainView === "highway"}<div class="highwaybox"><HighwayScreen /></div>{:else}<Timeline />{/if}
      <Panels />
    </section>
  </main>
</div>
<!-- The phone layout shows its own, under its menu sheet. -->
{#if editor.lookPreview}<LookPreview />{/if}
{/if}

{#if library.visible}<Library />{/if}

<div class="drop" class:show={dropping}>Drop chart files</div>
<!-- A new toast rises in as the one before sinks away, in the same spot. Global, so it still moves
     when the whole block goes (the toast timing out). -->
<div class="toasts" class:top={layout.compact} aria-live="polite">
  {#if editor.toast}
    {#key editor.toast.id}
      <div class="toast" role="status" in:rise|global={{ from: toastFrom }} out:rise|global={{ from: toastFrom }}
        use:dismissable={{ axis: "x", toward: 0, onClose: () => { editor.toast = null; } }}>{editor.toast.text}</div>
    {/key}
  {/if}
</div>

<style>
  .app {
    height: 100%; display: grid; grid-template-rows: auto minmax(0, 1fr);
    padding: env(safe-area-inset-top) max(16px, env(safe-area-inset-right)) env(safe-area-inset-bottom) max(16px, env(safe-area-inset-left));
  }
  .work { display: grid; grid-template-columns: minmax(260px, 340px) minmax(0, 1fr); gap: 16px; padding-block: 12px; min-height: 0; }
  .pane { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
  .pane h2 { margin: 0; font: 700 15px/1 var(--display); text-transform: uppercase; letter-spacing: .08em; color: var(--text-dim); padding: 10px 12px 6px; }
  .lanepane { overflow: auto; }
  .timepane { display: grid; grid-template-rows: auto auto minmax(0, 1fr); }
  /* The highway takes most of the pane's height; the tabs keep what's left, and scroll. */
  .highwaybox { height: clamp(320px, 58vh, 720px); min-height: 0; border-bottom: 1px solid var(--line); }
  .toasts {
    position: fixed; left: 16px; right: 16px; bottom: max(18px, env(safe-area-inset-bottom)); z-index: 30; pointer-events: none;
    display: grid; justify-items: center;
  }
  /* On a phone the bottom is all buttons: toasts drop in under the top bar instead. */
  .toasts.top { bottom: auto; top: calc(env(safe-area-inset-top) + 60px); }
  /* Both in one cell, so one leaving and the next arriving overlap rather than stack. */
  .toast {
    grid-area: 1 / 1; background: var(--raised); border: 1px solid var(--accent);
    padding: 8px 14px; border-radius: 8px; font-size: 13px; max-width: 100%; box-shadow: 0 6px 18px var(--shadow);
    /* Swipe it aside to dismiss it; the space around it lets taps through. */
    pointer-events: auto; touch-action: none;
  }
  .drop {
    position: fixed; inset: 0; background: color-mix(in srgb, var(--accent) 13%, transparent); border: 3px dashed var(--accent); display: grid; place-items: center;
    font: 700 28px var(--display); text-transform: uppercase; z-index: 4; pointer-events: none;
    opacity: 0; visibility: hidden; transition: opacity 120ms, visibility 0s 120ms;
  }
  .drop.show { opacity: 1; visibility: visible; transition: opacity 120ms; }
  /* Narrow: the panes stack, and the page scrolls instead of each pane. */
  @media (max-width: 860px) { .app { height: auto; } .work { grid-template-columns: minmax(0, 1fr); } }
</style>
