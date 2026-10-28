<script lang="ts">
  // The whole chart in a strip beside the highway (views/minimap.ts draws it). Touch or drag it to jump.
  import { endOf } from "../model/chart";
  import { appearance } from "../store/appearance.svelte";
  import { doc } from "../store/document.svelte";
  import { transport } from "../store/transport.svelte";
  import { practice } from "../store/practice.svelte";
  import { seek, songLength } from "../store/playback";
  import { drawMinimap, minimapTime } from "../views/minimap";
  import { prepare, theme } from "../views/theme";

  let canvas: HTMLCanvasElement;
  let w = $state(0), h = $state(0);
  let dragging = false;

  const length = $derived(Math.max(1, endOf(doc.chart, doc.tempo), songLength() ?? 0));

  $effect(() => {
    if (!w || !h) return;
    drawMinimap(prepare(canvas, w, h), w, h, { chart: doc.chart, tempo: doc.tempo, length, time: transport.time, loop: practice.loop }, theme(appearance.scheme));
  });

  function jump(ev: PointerEvent): void {
    const r = canvas.getBoundingClientRect();
    seek(minimapTime(r.height, length, ev.clientY - r.top));
  }
</script>

<div class="map" bind:clientWidth={w} bind:clientHeight={h}>
  <canvas
    bind:this={canvas}
    aria-label="The whole chart: touch to jump"
    onpointerdown={ev => { dragging = true; canvas.setPointerCapture(ev.pointerId); jump(ev); }}
    onpointermove={ev => { if (dragging) jump(ev); }}
    onpointerup={() => { dragging = false; }}
    onpointercancel={() => { dragging = false; }}
  ></canvas>
</div>

<style>
  .map { position: relative; flex: 1; min-height: 60px; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; }
</style>
