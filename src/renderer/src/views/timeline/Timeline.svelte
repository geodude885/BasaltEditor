<script lang="ts">
  // The chart over time. Click the ruler or waveform to seek, a phase to edit it, an event to select
  // it; drag events to move them, drag empty rows to box-select, double-click a row to add there.
  import { evTime, phaseTime, setEvTime } from "../../model/chart";
  import type { ChartEvent } from "../../model/types";
  import { addMove, addProjectile, pickCycled, select, zoom } from "../../store/actions";
  import { doc } from "../../store/document.svelte";
  import { editor } from "../../store/editor.svelte";
  import { seek, songStart } from "../../store/playback";
  import { normalise, prepare, theme, type Box } from "../theme";
  import { drawTimeline } from "./draw";
  import { eventsAt, HEIGHT, inRow, markers, ROWS, tOf } from "./geometry";

  let canvas: HTMLCanvasElement;
  let w = $state(0);
  type Drag =
    | { kind: "seek" }
    | { kind: "box"; add: boolean; before: number[] }
    | { kind: "move"; start: number; before: string; times: [ChartEvent, number][]; moved: boolean };
  let drag: Drag | null = null;
  /** The box being dragged to select, drawn while it is. */
  let box = $state<Box | null>(null);

  const placed = $derived(markers(doc.chart, doc.tempo, editor.view));

  $effect(() => { editor.timelineWidth = w; });

  $effect(() => {
    if (!w) return;
    const ctx = prepare(canvas, w, HEIGHT);
    drawTimeline(ctx, w, HEIGHT, {
      chart: doc.chart, tempo: doc.tempo, view: editor.view, time: editor.time, snap: editor.snap,
      selection: editor.selection, selectedPhase: editor.selectedPhase, markers: placed,
      song: editor.song, songStart: songStart(), clips: editor.clips, box,
    }, theme());
  });

  const t = (x: number) => tOf(editor.view, x);
  const snapped = (time: number) => doc.tempo.snap(time, editor.snap);
  const at = (ev: PointerEvent | WheelEvent): [number, number] => { const r = canvas.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };

  function pointerdown(ev: PointerEvent): void {
    const [x, y] = at(ev);
    canvas.setPointerCapture(ev.pointerId);
    if (y < ROWS.phase[0]) { seek(Math.max(0, t(x))); drag = { kind: "seek" }; return; }
    if (inRow("phase", y)) {
      const time = t(x), phases = doc.chart.phases ?? [];
      editor.selectedPhase = phases.findIndex((p, i) => phaseTime(p, doc.tempo) <= time && (i + 1 >= phases.length || phaseTime(phases[i + 1], doc.tempo) > time));
      editor.selection.clear();
      editor.tab = "chart";
      return;
    }
    const under = eventsAt(placed, x, y);
    if (under.length) {
      const hit = pickCycled(under, "timeline", x, y);
      if (!editor.selection.has(hit)) select(hit, ev.shiftKey);
      const events = doc.chart.events;
      drag = { kind: "move", start: t(x), before: doc.text, times: [...editor.selection].map(i => [events[i], evTime(events[i], doc.tempo)]), moved: false };
      return;
    }
    if (ev.detail === 2 && inRow("shot", y)) { seek(snapped(t(x))); addProjectile(); return; }
    if (ev.detail === 2 && inRow("move", y)) { seek(snapped(t(x))); addMove(); return; }
    // Empty space in the event rows: drag a box to select (shift adds); a click alone still seeks there.
    if (y >= ROWS.shot[0] && y < ROWS.move[0] + ROWS.move[1]) {
      drag = { kind: "box", add: ev.shiftKey, before: [...editor.selection] };
      box = { x0: x, y0: y, x1: x, y1: y };
      return;
    }
    if (!ev.shiftKey) editor.selection.clear();
    seek(Math.max(0, t(x)));
    drag = { kind: "seek" };
  }

  function pointermove(ev: PointerEvent): void {
    if (!drag) return;
    const [x, y] = at(ev);
    if (drag.kind === "box") {
      if (!box) return;
      box = { ...box, x1: x, y1: y };
      const b = normalise(box), inside = new Set(drag.add ? drag.before : []);
      for (const m of placed) if (m.x >= b.x0 && m.x <= b.x1 && m.y >= b.y0 && m.y <= b.y1) inside.add(m.i);
      editor.setSelection(inside);
      return;
    }
    if (drag.kind === "seek") { seek(Math.max(0, t(x))); return; }
    const delta = t(x) - drag.start;
    if (Math.abs(delta * editor.view.pps) < 3 && !drag.moved) return;
    drag.moved = true;
    for (const [e, from] of drag.times) setEvTime(e, snapped(from + delta), doc.tempo);
  }

  function pointerup(): void {
    if (drag?.kind === "box" && box) {
      const b = box;
      if (Math.abs(b.x1 - b.x0) < 4 && Math.abs(b.y1 - b.y0) < 4) {
        if (!drag.add) editor.selection.clear();
        seek(Math.max(0, t(b.x0)));
      }
      editor.selectedPhase = -1;
    } else if (drag?.kind === "move" && drag.moved) {
      const moved = drag.times.map(([e]) => e);
      doc.commit(drag.before, ["events"]);
      editor.setSelection(moved.map(e => doc.chart.events.indexOf(e)));
    }
    drag = null;
    box = null;
  }

  // Not onwheel: it must not be passive, or preventDefault cannot stop the page scrolling.
  $effect(() => {
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => canvas.removeEventListener("wheel", wheel);
  });

  function wheel(ev: WheelEvent): void {
    ev.preventDefault();
    const [x] = at(ev);
    if (ev.ctrlKey || ev.metaKey) zoom(ev.deltaY < 0 ? 1.25 : 0.8, x);
    else editor.view.t0 = Math.max(-1, editor.view.t0 + (ev.deltaX || ev.deltaY) / editor.view.pps);
  }
</script>

<div class="wrap" bind:clientWidth={w}>
  <canvas
    bind:this={canvas}
    style:height="{HEIGHT}px"
    onpointerdown={pointerdown}
    onpointermove={pointermove}
    onpointerup={pointerup}
    aria-label="Timeline: song waveform, beats, phases, projectiles, moves and recorded clips"
  ></canvas>
</div>

<style>
  .wrap { position: relative; border-bottom: 1px solid var(--line); }
  canvas { width: 100%; display: block; touch-action: none; }
</style>
