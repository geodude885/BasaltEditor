<script lang="ts">
  import { doc } from "../../store/document.svelte";
  import { editor } from "../../store/editor.svelte";

  const keys: [string, string][] = [
    ["Space", "Play / pause"], ["Home", "Back to the start"],
    ["P", "Add a projectile at the playhead"], ["M", "Add a move at the playhead"],
    ["Delete", "Delete the selection"], ["X", "Mirror the selection left/right"],
    ["Ctrl C / V", "Copy the selection / paste it at the playhead"],
    ["← →", "Move the selection by the snap (Shift: by a bar); with nothing selected, move the playhead"],
    ["Ctrl Z / Y", "Undo / redo"], ["[ ]", "Zoom the timeline (or Ctrl + scroll)"],
    ["Ctrl S", "Save into the open chart folder (else save chart.json as…)"], ["Ctrl O", "Open chart files"],
    ["Double-click", "On the lane: a projectile from there. On a timeline row: a projectile or move at that beat."],
  ];
</script>

{#if editor.showText}
  <label><span>chart.json - select all and copy</span>
    <!-- svelte-ignore a11y_autofocus -->
    <textarea rows="14" readonly autofocus value={doc.text} onfocus={e => e.currentTarget.select()}></textarea>
  </label>
  <div class="row"><button onclick={() => { editor.showText = false; }}>Done</button></div>
{/if}

<div class="keys">
  {#each keys as [key, what] (key)}<kbd>{key}</kbd><span>{what}</span>{/each}
</div>
<div class="note">
  To edit a chart from the game: <b>Open folder</b> and pick its folder in the game's <code>UserData/BossBattles/Charts</code>, then
  <b>Save</b> - the game reloads it within a second. A <b>.bbchart</b> package opens too, and <b>Package</b> makes one with the song, cover
  and clips to share. Only the parts you change are rewritten: comments and recorded clips stay as they were.
</div>

<style>
  .keys { display: grid; grid-template-columns: max-content 1fr; gap: 4px 14px; font-size: 13px; }
  kbd { font: 12px var(--mono); padding: 1px 6px; border: 1px solid var(--line); border-radius: 4px; background: var(--ground); }
  textarea { font: 12px var(--mono); }
</style>
