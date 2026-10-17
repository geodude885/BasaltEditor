<script lang="ts">
  import { redo, undo } from "../store/actions";
  import { doc } from "../store/document.svelte";
  import { editor } from "../store/editor.svelte";
  import { copyChart, openFiles, openFolder, save, saveChartAs, savePackage } from "../store/files";

  const count = $derived(editor.problems.length);
</script>

<header class="bar">
  <div class="brand">Boss <b>Battles</b> Charts</div>
  <div class="chartname" title={editor.folder ?? doc.name}>{doc.chart.name || "Untitled"}{doc.dirty ? " •" : ""}</div>
  <div class="group">
    <button title="Start a new chart from the template" onclick={() => { editor.confirmNew = true; editor.tab = "chart"; }}>New</button>
    <button title="Open chart.json, its song, cover and clips - or a .bbchart (Ctrl+O)" onclick={openFiles}>Open files…</button>
    <button title="Open a chart folder to edit it in place" onclick={openFolder}>Open folder…</button>
    <button class="primary" title={editor.folder ? `Write chart.json back into ${editor.folder} (Ctrl+S)` : "Save chart.json (Ctrl+S)"} onclick={save}>
      {editor.folder ? "Save" : "Save as…"}
    </button>
    <button title="Copy chart.json - paste it over your chart's file; the game reloads it" onclick={copyChart}>Copy chart.json</button>
    {#if editor.folder}<button title="Save chart.json somewhere else" onclick={saveChartAs}>Save as…</button>{/if}
    <button title="Save a package (.bbchart) with the song, cover and clips - drop it into the game's Charts folder" onclick={savePackage}>Package…</button>
  </div>
  <div class="spacer"></div>
  <div class="group">
    <button title="Undo (Ctrl+Z)" disabled={!doc.canUndo} onclick={undo}>Undo</button>
    <button title="Redo (Ctrl+Y)" disabled={!doc.canRedo} onclick={redo}>Redo</button>
    <button class="chip" class:bad={count} class:ok={!count} onclick={() => { editor.tab = "problems"; }}>
      {count ? `${count} problem${count === 1 ? "" : "s"}` : "no problems"}
    </button>
  </div>
</header>

<style>
  .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding-block: 10px; border-bottom: 1px solid var(--line); }
  .brand { font: 700 22px/1 var(--display); letter-spacing: .02em; text-transform: uppercase; }
  .brand b { color: var(--lane); }
  .group { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .spacer { flex: 1; }
  .chartname { font: 600 18px/1.1 var(--display); color: var(--sand); max-width: 22ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chip { font: 500 12px var(--mono); padding: 3px 8px; border-radius: 999px; border: 1px solid var(--line); background: none; }
  .chip.ok { color: var(--good); border-color: #4fd1a555; }
  .chip.bad { color: var(--bad); border-color: #ff5a5a66; }
</style>
