<script lang="ts">
  // The desktop layout's playing and adding controls, above the timeline or the highway. The buttons
  // run commands from store/commands.ts; the rest are playing settings.
  import Icon from "./Icon.svelte";
  import TapOffset from "./TapOffset.svelte";
  import ViewSwitch from "./ViewSwitch.svelte";
  import { beatText, clockText } from "../model/tempo";
  import { commandButton } from "../store/commands";
  import { doc } from "../store/document.svelte";
  import { display } from "../store/display.svelte";
  import { editing } from "../store/editing.svelte";
  import { transport } from "../store/transport.svelte";
  import { setRate, setVolume } from "../store/playback";
  import { num } from "./fields";

  const clock = $derived.by(() => {
    const t = Math.max(0, transport.time), tp = doc.tempo;
    return {
      time: clockText(t, 3),
      beat: tp.ok ? `beat ${beatText(tp.beat(t), 2)}` : "no tempo",
    };
  });
</script>

<div class="transport">
  <ViewSwitch />
  <button class="primary" {...commandButton("play")}>{transport.playing ? "Pause" : "Play"}</button>
  <button {...commandButton("to-start")} aria-label="Back to the start"><Icon name="start" /></button>
  <div class="clock">{clock.time}<small>{clock.beat}</small></div>
  <label><span>Speed</span>
    <select value={String(transport.rate)} onchange={e => setRate(num(e))}>
      <option value="1">100%</option><option value="0.75">75%</option><option value="0.5">50%</option><option value="0.25">25%</option>
    </select>
  </label>
  <label><span>Snap</span>
    <select value={String(editing.snap)} onchange={e => { editing.snap = num(e); }}>
      <option value="1">1 beat</option><option value="0.5">1/2</option><option value="0.25">1/4</option><option value="0.125">1/8</option><option value="0">off</option>
    </select>
  </label>
  <button {...commandButton("click")}>Click</button>
  <label><span>Volume</span>
    <input type="range" min="0" max="1" step="0.05" value={transport.volume} oninput={e => setVolume(num(e))}
      title="Editor volume (song and click). Not saved in the chart." />
  </label>
  {#if display.mainView === "highway"}
    <TapOffset />
  {:else}
    <button {...commandButton("zoom-out")}>−</button>
    <button {...commandButton("zoom-in")}>+</button>
  {/if}
  <div class="row">
    <button {...commandButton("add-projectile")}>+ Projectile</button>
    <button {...commandButton("add-move")}>+ Move</button>
    <button {...commandButton("add-phase")}>+ Phase</button>
  </div>
  <!-- Touch screens have no keyboard: the shortcuts that edit the selection, as buttons. Hidden with a mouse. -->
  <div class="row touch">
    <button {...commandButton("select-mode")}>Select</button>
    <button {...commandButton("multi-select")}>Multi-select</button>
    <button {...commandButton("delete")}>Delete</button>
    <button {...commandButton("mirror")}>Mirror</button>
    <button {...commandButton("copy")}>Copy</button>
    <button {...commandButton("paste")}>Paste</button>
  </div>
</div>

<style>
  .transport { display: flex; flex-wrap: wrap; gap: 8px 10px; align-items: center; padding: 10px 12px; border-bottom: 1px solid var(--line); }
  select { padding: 3px 4px; }
  .touch { display: none; }
  @media (pointer: coarse) {
    .touch { display: flex; flex-wrap: wrap; gap: 6px; }
    button { min-height: 36px; }
  }
</style>
