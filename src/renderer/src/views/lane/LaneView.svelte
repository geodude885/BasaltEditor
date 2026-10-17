<script lang="ts">
  // The lane from above. Click a projectile to select it, drag its start or aim point, drag a box to
  // select several, double-click (or alt-click) the floor to add one there.
  import { evTime, laneOf } from "../../model/chart";
  import { round } from "../../model/tempo";
  import { addProjectile, pickCycled, select } from "../../store/actions";
  import { doc } from "../../store/document.svelte";
  import { editor } from "../../store/editor.svelte";
  import { normalise, prepare, theme, type Box } from "../theme";
  import { drawLane } from "./draw";
  import { laneMap, onFootprint, originPx } from "./geometry";

  let canvas: HTMLCanvasElement;
  let w = $state(0), h = $state(0);
  /** Dragging a selected projectile's start or aim point. */
  let drag: { index: number; part: "from" | "to"; before: string; moved: boolean } | null = null;
  /** Dragging a box to select; `before` is the selection it adds to. */
  let box = $state<(Box & { add: boolean; before: number[] }) | null>(null);

  const map = $derived(laneMap(w, h, laneOf(doc.chart)));

  $effect(() => {
    if (!w || !h) return;
    const ctx = prepare(canvas, w, h);
    drawLane(ctx, w, h, map, { chart: doc.chart, tempo: doc.tempo, time: editor.time, selection: editor.selection, box }, theme());
  });

  const at = (ev: PointerEvent): [number, number] => { const r = canvas.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };

  function pointerdown(ev: PointerEvent): void {
    const [px, py] = at(ev), events = doc.chart.events;
    // Grab the selected projectile's origin or aim point.
    for (const i of editor.selection) {
      const s = events[i]?.projectile;
      if (!s) continue;
      const [fx, fy] = originPx(s, map);
      if (Math.hypot(px - fx, py - fy) < 14) { drag = { index: i, part: "from", before: doc.text, moved: false }; canvas.setPointerCapture(ev.pointerId); return; }
      if (s.to && s.to !== "player") {
        const [tx, ty] = map.toPx(+s.to.x || 0, 0);
        if (Math.hypot(px - tx, py - ty) < 12) { drag = { index: i, part: "to", before: doc.text, moved: false }; canvas.setPointerCapture(ev.pointerId); return; }
      }
    }
    // Pick a projectile under the click, by its footprint - the nearest in time to the playhead first;
    // clicking the same spot again steps through what is stacked there.
    const under = events.map((e, i) => [e, i] as const)
      .filter(([e]) => e.projectile?.from && onFootprint(e.projectile, map, px, py))
      .sort((a, b) => Math.abs(evTime(a[0], doc.tempo) - editor.time) - Math.abs(evTime(b[0], doc.tempo) - editor.time))
      .map(([, i]) => i);
    if (under.length) { select(pickCycled(under, "lane", px, py), ev.shiftKey); return; }
    if (ev.detail === 2 || ev.altKey) {
      const [x, z] = map.toLane(px, py);
      addProjectile({ x: round(x, 1), z: round(Math.min(laneOf(doc.chart).length, Math.max(0.5, z)), 1) });
      return;
    }
    // Empty floor: drag a box to select what starts inside it (shift adds); a click alone clears.
    box = { x0: px, y0: py, x1: px, y1: py, add: ev.shiftKey, before: [...editor.selection] };
    canvas.setPointerCapture(ev.pointerId);
  }

  function pointermove(ev: PointerEvent): void {
    const [px, py] = at(ev);
    if (box) {
      box.x1 = px; box.y1 = py;
      const b = normalise(box), inside = box.add ? new Set(box.before) : new Set<number>();
      doc.chart.events.forEach((e, i) => {
        if (!e.projectile?.from) return;
        const [fx, fy] = originPx(e.projectile, map);
        if (fx >= b.x0 && fx <= b.x1 && fy >= b.y0 && fy <= b.y1) inside.add(i);
      });
      editor.setSelection(inside);
      return;
    }
    if (!drag) return;
    const [x, z] = map.toLane(px, py), s = doc.chart.events[drag.index].projectile!, L = laneOf(doc.chart);
    const across = round(Math.max(-L.width / 2 - 2, Math.min(L.width / 2 + 2, x)), 1);
    drag.moved = true;
    if (drag.part === "from") { s.from.x = across; s.from.z = round(Math.max(0.5, Math.min(L.length, z)), 1); }
    else if (s.to && s.to !== "player") s.to.x = across;
  }

  function pointerup(): void {
    if (box) {
      if (Math.abs(box.x1 - box.x0) < 4 && Math.abs(box.y1 - box.y0) < 4 && !box.add) editor.selection.clear();
      box = null;
      editor.selectedPhase = -1;
      return;
    }
    if (drag?.moved) doc.commit(drag.before, ["events"]);
    drag = null;
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
