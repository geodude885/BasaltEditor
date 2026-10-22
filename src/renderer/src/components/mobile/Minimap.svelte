<script lang="ts">
  // The whole chart in a strip, the start at the bottom like the highway: a tick for each projectile,
  // the loop shaded, the playhead as a line. Touch or drag it to jump.
  import { endOf, evTime } from "../../model/chart";
  import { appearance } from "../../store/appearance.svelte";
  import { doc } from "../../store/document.svelte";
  import { editor } from "../../store/editor.svelte";
  import { mobile } from "../../store/mobile.svelte";
  import { seek, songLength } from "../../store/playback";
  import { alpha, prepare, theme } from "../../views/theme";

  let canvas: HTMLCanvasElement;
  let w = $state(0), h = $state(0);
  let dragging = false;

  const length = $derived(Math.max(1, endOf(doc.chart, doc.tempo), songLength() ?? 0));
  const yOf = (t: number) => h - (t / length) * h;

  $effect(() => {
    if (!w || !h) return;
    const ctx = prepare(canvas, w, h), t = theme(appearance.scheme);
    ctx.fillStyle = t.timeline;
    ctx.fillRect(0, 0, w, h);
    if (mobile.loop) {
      const top = yOf(mobile.loop[1]);
      ctx.fillStyle = alpha(t.accent, 0.2);
      ctx.fillRect(0, top, w, yOf(mobile.loop[0]) - top);
    }
    ctx.fillStyle = alpha(t.text, 0.55);
    for (const e of doc.chart.events) {
      if (!e.projectile) continue;
      const at = evTime(e, doc.tempo);
      if (Number.isFinite(at)) ctx.fillRect(2, Math.round(yOf(at)), w - 4, 1);
    }
    ctx.fillStyle = t.accent;
    ctx.fillRect(0, Math.round(yOf(Math.max(0, editor.time))) - 1, w, 3);
  });

  function jump(ev: PointerEvent): void {
    const r = canvas.getBoundingClientRect();
    seek(Math.max(0, Math.min(length, (1 - (ev.clientY - r.top) / r.height) * length)));
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
