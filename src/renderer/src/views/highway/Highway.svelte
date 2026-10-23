<script lang="ts">
  // The highway editor: columns across the lane, time flowing down to the hit line at the playhead.
  // Drag empty space up and down to scrub, tap it to add a projectile there, hold to box-select. Tap
  // a tile to select it; drag it up or down to retime it and sideways to change its column. Two
  // fingers stretch or squash time.
  import { evTime, laneOf, setEvTime } from "../../model/chart";
  import { columnOfX, moveToColumn } from "../../model/columns";
  import type { ChartEvent } from "../../model/types";
  import { addProjectileInColumn, select } from "../../store/actions";
  import { appearance } from "../../store/appearance.svelte";
  import { doc } from "../../store/document.svelte";
  import { editor } from "../../store/editor.svelte";
  import { practice } from "../../store/practice.svelte";
  import { seek, songStart } from "../../store/playback";
  import { boxIsAClick, prepare, theme, type Box } from "../theme";
  import { Pinch } from "../touch";
  import { drawHighway } from "./draw";
  import {
    columnIndexAtX, highwayColumns, HIT_LINE_FROM_TOP, LARGEST_HIGHWAY_PPS, SMALLEST_HIGHWAY_PPS, tiles, tilesAt, tilesInBox, timeOfY,
    type HighwayView,
  } from "./geometry";

  let { loop = null }: { loop?: readonly [number, number] | null } = $props();

  let canvas: HTMLCanvasElement;
  let w = $state(0), h = $state(0);
  let box = $state<Box | null>(null);
  const columns = highwayColumns();

  const view = $derived<HighwayView>({ w, h, hitY: h * HIT_LINE_FROM_TOP, pps: practice.highwayPps, time: editor.time });
  const placed = $derived(tiles(doc.chart, doc.tempo, view, columns));

  $effect(() => {
    if (!w || !h) return;
    drawHighway(prepare(canvas, w, h), {
      chart: doc.chart, tempo: doc.tempo, view, columns, tiles: placed, selection: editor.selection,
      song: editor.song, songStart: songStart(), box, loop,
    }, theme(appearance.scheme));
  });

  type Drag =
    | { kind: "empty"; x0: number; y0: number; time0: number; tapTime: number; panning: boolean; timer: number; adding: boolean }
    | { kind: "box"; adding: boolean; addsTo: number[] }
    | { kind: "tiles"; x0: number; y0: number; textBefore: string; moved: boolean; starts: [ChartEvent, number, number][] };
  let drag: Drag | null = null;
  const pinch = new Pinch();

  const DRAG_STARTS_AFTER_PIXELS = 8;
  const LONG_PRESS_MS = 450;

  const pointerAt = (ev: PointerEvent | WheelEvent): [number, number] => { const r = canvas.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
  const adds = (ev: PointerEvent) => ev.shiftKey || editor.multiSelect;
  const snapped = (seconds: number) => doc.tempo.snap(seconds, editor.snap);

  function stretch(factor: number): void {
    practice.highwayPps = Math.max(SMALLEST_HIGHWAY_PPS, Math.min(LARGEST_HIGHWAY_PPS, practice.highwayPps * factor));
  }

  /** Lets go of a drag in progress, keeping tiles already moved. */
  function endDrag(): void {
    if (!drag) return;
    if (drag.kind === "empty") clearTimeout(drag.timer);
    if (drag.kind === "tiles" && drag.moved) {
      const moved = drag.starts.map(([e]) => e);
      doc.commit(drag.textBefore, ["events"]);
      editor.setSelection(moved.map(e => doc.chart.events.indexOf(e)).filter(i => i >= 0));
    }
    drag = null;
    box = null;
  }

  function pointerdown(ev: PointerEvent): void {
    const [x, y] = pointerAt(ev);
    canvas.setPointerCapture(ev.pointerId);
    // Pinches run along the highway, so the gesture is fed (y, x): its "middle" and "pan" are up and down.
    if (ev.pointerType === "touch" && pinch.down(ev.pointerId, y, x)) { endDrag(); return; }
    if (pinch.busy) return;
    const adding = adds(ev);
    const under = tilesAt(placed, x, y);
    if (under.length) {
      if (!editor.selection.has(under[0])) select(under[0], adding);
      const events = doc.chart.events, width = laneOf(doc.chart).width;
      drag = {
        kind: "tiles", x0: x, y0: y, textBefore: doc.text, moved: false,
        starts: [...editor.selection].filter(i => events[i]?.projectile).map((i): [ChartEvent, number, number] => [events[i], evTime(events[i], doc.tempo), columnOfX(+events[i].projectile!.from?.x || 0, width)]),
      };
      return;
    }
    // Select mode: empty space boxes straight away instead of scrubbing.
    if (editor.selectMode) {
      drag = { kind: "box", adding, addsTo: adding ? [...editor.selection] : [] };
      box = { x0: x, y0: y, x1: x, y1: y };
      return;
    }
    const d: Extract<Drag, { kind: "empty" }> = {
      kind: "empty", x0: x, y0: y, time0: editor.time, tapTime: timeOfY(view, y), panning: false, adding, timer: 0,
    };
    // Held still: box-select from here.
    d.timer = window.setTimeout(() => {
      if (drag !== d || d.panning) return;
      navigator.vibrate?.(12);
      drag = { kind: "box", adding, addsTo: adding ? [...editor.selection] : [] };
      box = { x0: x, y0: y, x1: x, y1: y };
    }, LONG_PRESS_MS);
    drag = d;
  }

  function pointermove(ev: PointerEvent): void {
    const [x, y] = pointerAt(ev);
    if (ev.pointerType === "touch") {
      const step = pinch.move(ev.pointerId, y, x);
      if (step) {
        stretch(step.zoom);
        seek(Math.max(0, editor.time + step.panX / practice.highwayPps));
        return;
      }
    }
    if (!drag) return;
    if (drag.kind === "empty") {
      if (!drag.panning && Math.hypot(x - drag.x0, y - drag.y0) < DRAG_STARTS_AFTER_PIXELS) return;
      if (!drag.panning) { drag.panning = true; clearTimeout(drag.timer); }
      // The highway follows the finger: pulling it down brings later times to the hit line.
      seek(Math.max(0, drag.time0 + (y - drag.y0) / practice.highwayPps));
    } else if (drag.kind === "box") {
      if (!box) return;
      box = { ...box, x1: x, y1: y };
      editor.setSelection(new Set([...drag.addsTo, ...tilesInBox(placed, box)]));
    } else {
      if (!drag.moved && Math.hypot(x - drag.x0, y - drag.y0) < DRAG_STARTS_AFTER_PIXELS) return;
      drag.moved = true;
      const deltaSeconds = (drag.y0 - y) / practice.highwayPps;
      const deltaColumns = columnIndexAtX(view, columns.length, x) - columnIndexAtX(view, columns.length, drag.x0);
      const width = laneOf(doc.chart).width;
      for (const [e, t, column] of drag.starts) {
        setEvTime(e, snapped(t + deltaSeconds), doc.tempo);
        const to = columns[Math.min(columns.length - 1, Math.max(0, column + deltaColumns))];
        if (e.projectile && to.kind === "projectile") moveToColumn(e.projectile, to.column, width);
      }
    }
  }

  function pointerup(ev: PointerEvent): void {
    if (ev.pointerType === "touch") pinch.up(ev.pointerId);
    if (drag?.kind === "empty" && !drag.panning && ev.type === "pointerup") {
      const d = drag;
      endDrag();
      tap(d);
      return;
    }
    if (drag?.kind === "box" && box && boxIsAClick(box) && !drag.adding) editor.selection.clear();
    endDrag();
  }

  /** A tap on empty space: let go of the selection, or add a tile there. */
  function tap(d: Extract<Drag, { kind: "empty" }>): void {
    if (editor.selection.size && !d.adding) { editor.selection.clear(); return; }
    const column = columns[columnIndexAtX(view, columns.length, d.x0)];
    if (column.kind === "projectile") addProjectileInColumn(Math.max(0, d.tapTime), column.column);
  }

  // Not onwheel: it must not be passive, or preventDefault cannot stop the page scrolling.
  $effect(() => {
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => canvas.removeEventListener("wheel", wheel);
  });

  function wheel(ev: WheelEvent): void {
    ev.preventDefault();
    if (ev.ctrlKey || ev.metaKey) stretch(ev.deltaY < 0 ? 1.15 : 1 / 1.15);
    else seek(Math.max(0, editor.time - ev.deltaY / practice.highwayPps));
  }
</script>

<div class="highway" bind:clientWidth={w} bind:clientHeight={h}>
  <canvas
    bind:this={canvas}
    onpointerdown={pointerdown}
    onpointermove={pointermove}
    onpointerup={pointerup}
    onpointercancel={pointerup}
    aria-label="Highway: the lane's columns, with time flowing down to the hit line"
  ></canvas>
</div>

<style>
  .highway { position: relative; width: 100%; height: 100%; min-height: 0; overflow: hidden; }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
</style>
