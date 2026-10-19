<script lang="ts">
  import { doc } from "../../store/document.svelte";
  import { editor } from "../../store/editor.svelte";
  import { SHORTCUTS } from "../../store/keyboard";
  import Logo from "../Logo.svelte";

  const keys: [string, string][] = [
    ...SHORTCUTS.map((s): [string, string] => [s.keysShown, s.description]),
    ["Double-click", "On the lane: a projectile from there. On a timeline row: a projectile, move or look at that beat."],
  ];
</script>

<div class="about">
  <Logo size={40} />
  <div><b>Basalt Editor</b> <span class="version">{__APP_VERSION__}</span><br />A chart editor for RUMBLE Boss Battles</div>
</div>

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
  .about { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; color: var(--text-dim); font-size: 13px; }
  .about :global(.logo) { color: var(--text); }
  .about b { font: 700 18px var(--display); text-transform: uppercase; letter-spacing: .04em; color: var(--text); }
  .version { font: 12px var(--mono); }
  .keys { display: grid; grid-template-columns: max-content 1fr; gap: 4px 14px; font-size: 13px; }
  kbd { font: 12px var(--mono); padding: 1px 6px; border: 1px solid var(--line); border-radius: 4px; background: var(--bg); }
  textarea { font: 12px var(--mono); }
</style>
