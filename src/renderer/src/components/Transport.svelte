<script lang="ts">
  import Icon from "./Icon.svelte";
  import { beatText, clockText } from "../model/tempo";
  import { addMove, addPhase, addProjectile, copySelected, mirrorSelected, paste, removeSelected, zoom } from "../store/actions";
  import { doc } from "../store/document.svelte";
  import { editor } from "../store/editor.svelte";
  import { ensureAudio, seek, setRate, setVolume } from "../store/playback";
  import { playOrPause } from "../store/practice.svelte";
  import { recording } from "../store/recording.svelte";
  import { num } from "./fields";

  const clock = $derived.by(() => {
    const t = Math.max(0, editor.time), tp = doc.tempo;
    return {
      time: clockText(t, 3),
      beat: tp.ok ? `beat ${beatText(tp.beat(t), 2)}` : "no tempo",
    };
  });
</script>

<div class="transport">
  <div class="views" role="group" aria-label="Editor">
    <button class:on={editor.mainView === "timeline"} aria-pressed={editor.mainView === "timeline"} onclick={() => { editor.mainView = "timeline"; }}>Timeline</button>
    <button class:on={editor.mainView === "highway"} aria-pressed={editor.mainView === "highway"} title="The lane's columns, time flowing down - and tap-along recording"
      onclick={() => { editor.mainView = "highway"; }}>Highway</button>
  </div>
  <button class="primary" title="Play / pause (Space)" onclick={playOrPause}>{editor.playing ? "Pause" : "Play"}</button>
  <button title="Back to the start (Home)" onclick={() => seek(0)} aria-label="Back to the start"><Icon name="start" /></button>
  <div class="clock">{clock.time}<small>{clock.beat}</small></div>
  <label><span>Speed</span>
    <select value={String(editor.rate)} onchange={e => setRate(num(e))}>
      <option value="1">100%</option><option value="0.75">75%</option><option value="0.5">50%</option><option value="0.25">25%</option>
    </select>
  </label>
  <label><span>Snap</span>
    <select value={String(editor.snap)} onchange={e => { editor.snap = num(e); }}>
      <option value="1">1 beat</option><option value="0.5">1/2</option><option value="0.25">1/4</option><option value="0.125">1/8</option><option value="0">off</option>
    </select>
  </label>
  <button class:on={editor.click} title="A click on every beat while playing" onclick={() => { editor.click = !editor.click; ensureAudio(); }}>Click</button>
  <label><span>Volume</span>
    <input type="range" min="0" max="1" step="0.05" value={editor.volume} oninput={e => setVolume(num(e))}
      title="How loud the editor plays - the song and the click. Not saved in the chart." />
  </label>
  {#if editor.mainView === "highway"}
    <label title="Taken off each recorded tap, to make up for the screen's and speaker's delay. If taps land late, move it right."><span>Tap timing {recording.offsetMs} ms</span>
      <input type="range" min="-150" max="250" step="5" value={recording.offsetMs} oninput={e => recording.setOffset(num(e))} />
    </label>
  {:else}
    <button title="Zoom out ( [ )" onclick={() => zoom(1 / 1.4)}>−</button>
    <button title="Zoom in ( ] )" onclick={() => zoom(1.4)}>+</button>
  {/if}
  <div class="row">
    <button title="Add a projectile at the playhead (P)" onclick={() => addProjectile()}>+ Projectile</button>
    <button title="Add a move at the playhead (M)" onclick={addMove}>+ Move</button>
    <button title="Start a phase at the playhead" onclick={addPhase}>+ Phase</button>
  </div>
  <!-- Touch screens have no keyboard: the shortcuts that edit the selection, as buttons. Hidden with a mouse. -->
  <div class="row touch">
    <button class:on={editor.multiSelect} aria-pressed={editor.multiSelect} title="Taps add to the selection, like holding Shift"
      onclick={() => { editor.multiSelect = !editor.multiSelect; }}>Multi-select</button>
    <button title="Delete the selection" disabled={!editor.selection.size} onclick={removeSelected}>Delete</button>
    <button title="Mirror the selection left/right" disabled={!editor.selection.size} onclick={mirrorSelected}>Mirror</button>
    <button title="Copy the selection" disabled={!editor.selection.size} onclick={copySelected}>Copy</button>
    <button title="Paste at the playhead" onclick={paste}>Paste</button>
  </div>
</div>

<style>
  .transport { display: flex; flex-wrap: wrap; gap: 8px 10px; align-items: center; padding: 10px 12px; border-bottom: 1px solid var(--line); }
  select { padding: 3px 4px; }
  .views { display: flex; }
  .views button { border-radius: 0; font: 600 13px var(--display); text-transform: uppercase; letter-spacing: .04em; }
  .views button:first-child { border-radius: 6px 0 0 6px; }
  .views button:last-child { border-radius: 0 6px 6px 0; border-left: 0; }
  .touch { display: none; }
  @media (pointer: coarse) {
    .touch { display: flex; flex-wrap: wrap; gap: 6px; }
    button { min-height: 36px; }
  }
</style>
