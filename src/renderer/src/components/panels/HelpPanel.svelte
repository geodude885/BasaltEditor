<script lang="ts">
  import { doc } from "../../store/document.svelte";
  import { editor } from "../../store/editor.svelte";
  import { shortcutCommands } from "../../store/commands";
  import Logo from "../Logo.svelte";

  const keys: [string, string][] = $derived([
    ...shortcutCommands().map((c): [string, string] => [c.keys!, c.help ?? c.label]),
    ["Double-click", "On the lane: a projectile from there. On a timeline row: a projectile, move or look at that beat."],
    ["1 – 5", "With Record on, on the highway: tap that column as the song plays. Pausing ends the take."],
    ["Alt / F10", "Go to the menus; the arrows move round them"],
  ]);
</script>

<div class="about">
  <Logo size={40} />
  <div><b>Basalt Editor</b> <span class="version">{__APP_VERSION__}</span><br />A chart editor for Basalt, the RUMBLE boss battle mod</div>
</div>

{#if editor.showText}
  <label><span>chart.json (select all and copy)</span>
    <!-- svelte-ignore a11y_autofocus -->
    <textarea rows="14" readonly autofocus value={doc.text} onfocus={e => e.currentTarget.select()}></textarea>
  </label>
  <div class="row"><button onclick={() => { editor.showText = false; }}>Done</button></div>
{/if}

<div class="keys">
  {#each keys as [key, what] (key)}<kbd>{key}</kbd><span>{what}</span>{/each}
</div>
<div class="note touch">
  With a finger: on empty space, a tap adds there, a drag pans the timeline or scrubs the highway, and a held press draws a
  selection box; two fingers zoom, and a two-finger tap undoes. Hold a projectile for Copy, Mirror and Delete.
  <b>Select</b> draws boxes straight away, and <b>Multi</b> makes taps add to the selection. Swipe in from the left
  edge for the menu; drag the menu, a drawer, the selected card or a message away to close it.
</div>
<div class="note">
  To edit a chart from the game: open it from <b>Your charts</b>, or <b>Open folder</b> and pick its folder in the game's
  <code>UserData/Basalt/Charts</code>, then <b>Save</b>. The game reloads it automatically. In the desktop app, <b>New</b> starts
  a chart in a folder of its own there, named after it, and <b>Save</b> gives a chart opened from anywhere else one; in a browser,
  Your charts keeps every chart as you go. A <b>.bbchart</b> package opens too,
  and <b>Package</b> makes one with the song, cover and clips to share. Only the parts you change are rewritten: comments and
  recorded clips elsewhere stay as they were (comments among the events go when you edit an event).
</div>

<style>
  .about { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; color: var(--text-dim); font-size: 13px; }
  .about :global(.logo) { color: var(--text); }
  .about b { font: 700 18px var(--display); text-transform: uppercase; letter-spacing: .04em; color: var(--text); }
  .version { font: 12px var(--mono); }
  .keys { display: grid; grid-template-columns: max-content 1fr; gap: 4px 14px; font-size: 13px; }
  kbd { font: 12px var(--mono); padding: 1px 6px; border: 1px solid var(--line); border-radius: 4px; background: var(--bg); }
  textarea { font: 12px var(--mono); }
  .touch { display: none; }
  @media (pointer: coarse) { .touch { display: block; } }
</style>
