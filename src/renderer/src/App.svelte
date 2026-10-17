<script lang="ts">
  import { onMount } from "svelte";
  import Inspector from "./components/Inspector.svelte";
  import Panels from "./components/Panels.svelte";
  import TopBar from "./components/TopBar.svelte";
  import Transport from "./components/Transport.svelte";
  import { SAMPLE } from "./model/samples";
  import {
    addMove, addProjectile, copySelected, fit, loadChart, mirrorSelected, nudge, paste, redo, removeSelected, toast, undo, zoom,
  } from "./store/actions";
  import { doc, restoreDraft } from "./store/document.svelte";
  import { editor } from "./store/editor.svelte";
  import { openDropped, openFiles, save } from "./store/files";
  import { play, seek } from "./store/playback";
  import LaneView from "./views/lane/LaneView.svelte";
  import Timeline from "./views/timeline/Timeline.svelte";

  // Start: the last draft, else the sample chart.
  const draft = restoreDraft();
  loadChart(draft?.text ?? SAMPLE, draft?.name ?? "Crossfire (example)");

  onMount(() => {
    // Fit the timeline again once the page has its real size.
    requestAnimationFrame(() => requestAnimationFrame(fit));
    if (!draft) toast("This is an example chart - open your own chart's files, or press New");
  });

  $effect(() => { document.title = `${doc.dirty ? "• " : ""}${doc.chart.name || "Untitled"} - Boss Battles Chart Editor`; });

  function keydown(ev: KeyboardEvent): void {
    const k = ev.key, ctrl = ev.ctrlKey || ev.metaKey;
    if (ctrl && k.toLowerCase() === "s") { ev.preventDefault(); void save(); return; }
    if (ctrl && k.toLowerCase() === "o") { ev.preventDefault(); void openFiles(); return; }
    if ((ev.target as Element).closest?.("input, select, textarea")) return;
    if (k === " ") { ev.preventDefault(); play(); }
    else if (k === "Home") seek(0);
    else if (ctrl && k.toLowerCase() === "z") { ev.preventDefault(); if (ev.shiftKey) redo(); else undo(); }
    else if (ctrl && k.toLowerCase() === "y") { ev.preventDefault(); redo(); }
    else if (ctrl && k.toLowerCase() === "c") copySelected();
    else if (ctrl && k.toLowerCase() === "v") paste();
    else if (ctrl) return;
    else if (k === "p" || k === "P") addProjectile();
    else if (k === "m" || k === "M") addMove();
    else if (k === "x" || k === "X") mirrorSelected();
    else if (k === "Delete" || k === "Backspace") removeSelected();
    else if (k === "[") zoom(1 / 1.4);
    else if (k === "]") zoom(1.4);
    else if (k === "ArrowLeft" || k === "ArrowRight") { ev.preventDefault(); nudge(k === "ArrowLeft" ? -1 : 1, ev.shiftKey); }
  }

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
</script>

<svelte:window onkeydown={keydown} ondragover={dragover} ondrop={drop} onblur={() => { dropping = false; }} />

<div class="app">
  <TopBar />
  <main class="work">
    <section class="pane lanepane" aria-label="Lane">
      <h2>Lane from above</h2>
      <LaneView />
      <Inspector />
    </section>
    <section class="pane timepane" aria-label="Timeline">
      <Transport />
      <Timeline />
      <Panels />
    </section>
  </main>
</div>

<div class="drop" class:show={dropping}>Drop chart files</div>
{#if editor.toast}
  {#key editor.toast.id}
    <div class="toast" role="status">{editor.toast.text}</div>
  {/key}
{/if}

<style>
  .app { height: 100%; display: grid; grid-template-rows: auto 1fr; padding-inline: 16px; }
  .work { display: grid; grid-template-columns: minmax(260px, 340px) minmax(0, 1fr); gap: 16px; padding-block: 12px; min-height: 0; }
  .pane { background: var(--slab); border: 1px solid var(--line); border-radius: 10px; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
  .pane h2 { margin: 0; font: 700 15px/1 var(--display); text-transform: uppercase; letter-spacing: .08em; color: var(--dust); padding: 10px 12px 6px; }
  .lanepane { overflow: auto; }
  .timepane { display: grid; grid-template-rows: auto auto minmax(0, 1fr); }
  .toast {
    position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); background: var(--slab-2); border: 1px solid var(--lane);
    padding: 8px 14px; border-radius: 8px; font-size: 13px; z-index: 5; max-width: calc(100% - 32px);
  }
  .drop {
    position: fixed; inset: 0; background: #ff7a1a22; border: 3px dashed var(--lane); display: none; place-items: center;
    font: 700 28px var(--display); text-transform: uppercase; z-index: 4; pointer-events: none;
  }
  .drop.show { display: grid; }
  @media (max-width: 860px) { .work { grid-template-columns: minmax(0, 1fr); } }
</style>
