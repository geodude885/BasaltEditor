<script lang="ts">
  // The lane from above. Click a projectile to select it, drag its start or aim point, drag a box to
  // select several, double-click (or alt-click) the floor to add one there.
  import { laneOf } from "../../model/chart";
  import { addProjectile, pickCycled, select } from "../../store/actions";
  import { doc } from "../../store/document.svelte";
  import { appearance } from "../../store/appearance.svelte";
  import { editor } from "../../store/editor.svelte";
  import { boxIsAClick, prepare, theme, type Box } from "../theme";
  import { drawLane } from "./draw";
  import { laneMap } from "./geometry";
  import { moveProjectilePoint, projectilesStartingInBox, whatALanePressHits, type ProjectilePoint } from "./interaction";

  let canvas: HTMLCanvasElement;
  let w = $state(0), h = $state(0);
  let pointDrag: { index: number; point: ProjectilePoint; textBefore: string; moved: boolean } | null = null;
  let boxDrag: { addsTo: number[]; adding: boolean } | null = null;
  let box = $state<Box | null>(null);

  const map = $derived(laneMap(w, h, laneOf(doc.chart)));

  $effect(() => {
    if (!w || !h) return;
    drawLane(prepare(canvas, w, h), w, h, map, { chart: doc.chart, tempo: doc.tempo, time: editor.time, selection: editor.selection, box }, theme(appearance.scheme));
  });

  const pointerAt = (ev: PointerEvent): [number, number] => { const r = canvas.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };

  function pointerdown(ev: PointerEvent): void {
    const [px, py] = pointerAt(ev);
    const press = whatALanePressHits(doc.chart, doc.tempo, editor.time, editor.selection, map, px, py, ev.detail === 2 || ev.altKey);
    if (press.kind === "select-projectile") { select(pickCycled(press.underPointer, "lane", px, py), ev.shiftKey); return; }
    if (press.kind === "add-projectile") { addProjectile(press.at); return; }
    canvas.setPointerCapture(ev.pointerId);
    if (press.kind === "drag-projectile-point") pointDrag = { index: press.index, point: press.point, textBefore: doc.text, moved: false };
    else { boxDrag = { addsTo: ev.shiftKey ? [...editor.selection] : [], adding: ev.shiftKey }; box = { x0: px, y0: py, x1: px, y1: py }; }
  }

  function pointermove(ev: PointerEvent): void {
    const [px, py] = pointerAt(ev);
    if (boxDrag && box) {
      box = { ...box, x1: px, y1: py };
      editor.setSelection(new Set([...boxDrag.addsTo, ...projectilesStartingInBox(doc.chart, map, box)]));
    } else if (pointDrag) {
      moveProjectilePoint(doc.chart, map, pointDrag.index, pointDrag.point, px, py);
      pointDrag.moved = true;
    }
  }

  function pointerup(): void {
    if (boxDrag && box) {
      if (boxIsAClick(box) && !boxDrag.adding) editor.selection.clear();
      editor.selectedPhase = -1;
    }
    if (pointDrag?.moved) doc.commit(pointDrag.textBefore, ["events"]);
    pointDrag = null;
    boxDrag = null;
    box = null;
  }
</script>

<canvas
  bind:this={canvas}
  bind:clientWidth={w}
  bind:clientHeight={h}
  onpointerdown={pointerdown}
  onpointermove={pointermove}
  onpointerup={pointerup}
  aria-label="The lane from above: you at the bottom, the actor at the top"
></canvas>

<style>
  canvas { width: 100%; aspect-ratio: 3 / 4; display: block; touch-action: none; cursor: crosshair; }
  @media (max-width: 860px) { canvas { aspect-ratio: 4 / 3; } }
</style>
