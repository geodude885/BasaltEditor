<script lang="ts">
  import { addTempoChange, setTempo, tempoList } from "../../model/edits";
  import { round } from "../../model/tempo";
  import { tap, tapBpm, toast } from "../../store/actions";
  import { doc } from "../../store/document.svelte";
  import { editor } from "../../store/editor.svelte";
  import { num } from "../fields";

  const list = $derived(tempoList(doc.chart));
  const taps = $derived(editor.tapTimes.length);

  function setChange(i: number, field: "beat" | "bpm", value: number): void {
    const next = tempoList(doc.chart);
    next[i] = { ...next[i], [field]: value };
    doc.change(["bpm"], () => setTempo(doc.chart, next));
  }

  function removeChange(i: number): void {
    doc.change(["bpm"], () => setTempo(doc.chart, tempoList(doc.chart).filter((_, j) => j !== i)));
  }

  function useTapped(): void {
    const bpm = round(tapBpm(), 1);
    doc.change(["bpm"], () => { doc.chart.bpm = bpm; });
    toast(`Tempo set to ${bpm} bpm`);
  }
</script>

<div class="note">
  The tempo lines the grid up with the song so projectiles snap to the beat. Tap along to find it, then check it against the click.
  Slowing the song down helps hear drift. If the first beat is late, raise "chart starts at song s" in the Chart tab.
</div>
<div class="row">
  <button class="primary" onclick={tap}>Tap</button>
  <span class="clock">{taps > 1 ? tapBpm().toFixed(1) : "–"}<small>bpm</small></span>
  <button disabled={taps <= 3} onclick={useTapped}>Use this tempo</button>
  <button onclick={() => { editor.tapTimes = []; }}>Reset</button>
</div>

<h3>Tempo changes</h3>
<div class="list">
  {#each list as change, i (i)}
    <div class="item">
      <label><span>From beat</span><input type="number" step="1" value={change.beat} disabled={i === 0} onchange={e => setChange(i, "beat", num(e))} /></label>
      <label><span>BPM</span><input type="number" step="0.1" value={change.bpm} onchange={e => setChange(i, "bpm", num(e))} /></label>
      <button disabled={i === 0} onclick={() => removeChange(i)}>Remove</button>
    </div>
  {:else}
    <div class="note">No tempo yet, so times are in seconds and snapping is off.</div>
  {/each}
</div>
<div class="row">
  <button onclick={() => doc.change(["bpm"], () => addTempoChange(doc.chart, editor.time, doc.tempo))}>
    {list.length ? "Tempo change at the playhead" : "Add a tempo"}
  </button>
</div>
