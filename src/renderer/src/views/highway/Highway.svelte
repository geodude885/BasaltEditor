<script lang="ts">
  // The highway editor: columns across the lane, time flowing down to the hit line at the playhead.
  // With a finger, drag empty space up and down to scrub, tap it to add a projectile there, hold to
  // box-select; two fingers stretch or squash time. With a mouse, as on the timeline: drag empty space
  // to box-select, click it to add, scroll to scrub (Ctrl: stretch). Either way, press a tile to
  // select it; drag it up or down to retime it and sideways to change its column.
  import { evTime, laneOf, setEvTime } from "../../model/chart";
  import { columnOfX, moveToColumn } from "../../model/columns";
  import type { ChartEvent } from "../../model/types";
  import { addProjectileInColumn, select, undoByTouch } from "../../store/actions";
  import { appearance } from "../../store/appearance.svelte";
  import { doc } from "../../store/document.svelte";
  import { display } from "../../store/display.svelte";
  import { editing } from "../../store/editing.svelte";
  import { session } from "../../store/session.svelte";
  import { transport } from "../../store/transport.svelte";
  import { ui } from "../../store/ui.svelte";
  import { practice } from "../../store/practice.svelte";
  import { seek, songStart } from "../../store/playback";
  import { boxIsAClick, prepare, theme, type Box } from "../theme";
  import { dragStartsAfterPixels, Fingers, restingFinger, WaitingPress } from "../touch";
  import { drawHighway } from "./draw";
  import { highwayColumns, HIT_LINE_FROM_TOP, LARGEST_HIGHWAY_PPS, SMALLEST_HIGHWAY_PPS, tiles, tilesInBox, type HighwayView } from "./geometry";
  import { scrubbedTime, shiftedColumn, tileDrag, whatAHighwayPressHits, whatAHighwayTapDoes } from "./interaction";

  let { loop = null }: { loop?: readonly [number, number] | null } = $props();

  let canvas: HTMLCanvasElement;
  let w = $state(0), h = $state(0);
  let box = $state<Box | null>(null);
  const columns = highwayColumns();

  const view = $derived<HighwayView>({ w, h, hitY: h * HIT_LINE_FROM_TOP, pps: practice.highwayPps, time: transport.time });
  const placed = $derived(tiles(doc.chart, doc.tempo, view, columns));

  $effect(() => {
    if (!w || !h) return;
    drawHighway(prepare(canvas, w, h), {
      chart: doc.chart, tempo: doc.tempo, view, columns, tiles: placed, selection: editing.selection,
      song: session.song, songStart: songStart(), box, loop, shotColouring: display.shotColouring,
    }, theme(appearance.scheme));
  });

  type Drag =
    // `at` is the highway as the press found it, so a tap adds where the finger was, even while playing.
    | { kind: "empty"; press: WaitingPress; at: HighwayView; time0: number; adding: boolean }
    | { kind: "box"; adding: boolean; addsTo: number[]; clickAdds: boolean; at: HighwayView }
    // `hold`: a finger resting on the tiles opens quick actions for them.
    | { kind: "tiles"; x0: number; y0: number; textBefore: string; moved: boolean; slop: number; starts: [ChartEvent, number, number][]; hold?: WaitingPress };
  let drag: Drag | null = null;
  // Pinches run along the highway: time runs down it.
  const fingers = new Fingers("y");

  const pointerAt = (ev: PointerEvent | WheelEvent): [number, number] => { const r = canvas.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
  const adds = (ev: PointerEvent) => ev.shiftKey || editing.multiSelect;
  const snapped = (seconds: number) => doc.tempo.snap(seconds, editing.snap);

  function stretch(factor: number): void {
    practice.highwayPps = Math.max(SMALLEST_HIGHWAY_PPS, Math.min(LARGEST_HIGHWAY_PPS, practice.highwayPps * factor));
  }

  function startBox(x: number, y: number, adding: boolean, clickAdds: boolean, at: HighwayView): void {
    drag = { kind: "box", adding, addsTo: adding ? [...editing.selection] : [], clickAdds, at };
    box = { x0: x, y0: y, x1: x, y1: y };
  }

  /** Lets go of a drag in progress, keeping tiles already moved. */
  function endDrag(): void {
    if (!drag) return;
    if (drag.kind === "empty") drag.press.end();
    if (drag.kind === "tiles") drag.hold?.end();
    if (drag.kind === "tiles" && drag.moved) {
      const moved = drag.starts.map(([e]) => e);
      doc.commit(drag.textBefore, ["events"]);
      editing.setSelection(moved.map(e => doc.chart.events.indexOf(e)).filter(i => i >= 0));
    }
    drag = null;
    box = null;
  }

  function pointerdown(ev: PointerEvent): void {
    const [x, y] = pointerAt(ev);
    canvas.setPointerCapture(ev.pointerId);
    if (fingers.down(ev, x, y)) { endDrag(); return; }
    if (fingers.busy) return;
    const adding = adds(ev), at = view, press = whatAHighwayPressHits(placed, x, y, ev.pointerType, editing.selectMode);
    if (press.kind === "tiles") {
      if (!editing.selection.has(press.index)) select(press.index, adding);
      const events = doc.chart.events, width = laneOf(doc.chart).width, held = { x: ev.clientX, y: ev.clientY };
      const d: Extract<Drag, { kind: "tiles" }> = {
        kind: "tiles", x0: x, y0: y, textBefore: doc.text, moved: false, slop: dragStartsAfterPixels(ev.pointerType),
        starts: [...editing.selection].filter(i => events[i]?.projectile).map((i): [ChartEvent, number, number] => [events[i], evTime(events[i], doc.tempo), columnOfX(+events[i].projectile!.from?.x || 0, width)]),
      };
      d.hold = restingFinger(ev, x, y, () => { if (drag === d && !d.moved) { drag = null; ui.quickActions = held; } });
      drag = d;
    } else if (press.kind === "box") {
      startBox(x, y, adding, press.clickAdds, at);
    } else {
      // Held still: box-select from here.
      const d: Extract<Drag, { kind: "empty" }> = {
        kind: "empty", at, time0: transport.time, adding,
        press: new WaitingPress(x, y, () => { if (drag === d) startBox(x, y, adding, false, at); }),
      };
      drag = d;
    }
  }

  function pointermove(ev: PointerEvent): void {
    const [x, y] = pointerAt(ev);
    const step = fingers.move(ev, x, y);
    if (step) {
      stretch(step.zoom);
      seek(Math.max(0, transport.time + step.panX / practice.highwayPps));
      return;
    }
    if (!drag) return;
    if (drag.kind === "empty") {
      if (drag.press.pans(x, y)) seek(scrubbedTime(drag.time0, drag.press.y0, y, practice.highwayPps));
    } else if (drag.kind === "box") {
      if (!box) return;
      box = { ...box, x1: x, y1: y };
      editing.setSelection(new Set([...drag.addsTo, ...tilesInBox(placed, box)]));
    } else {
      drag.hold?.pans(x, y);
      if (!drag.moved && Math.hypot(x - drag.x0, y - drag.y0) < drag.slop) return;
      drag.moved = true;
      const by = tileDrag(view, columns.length, drag.x0, drag.y0, x, y), width = laneOf(doc.chart).width;
      for (const [e, t, column] of drag.starts) {
        setEvTime(e, snapped(t + by.seconds), doc.tempo);
        if (e.projectile) moveToColumn(e.projectile, columns[shiftedColumn(column, by.columns, columns.length)].column, width);
      }
    }
  }

  function pointerup(ev: PointerEvent): void {
    // Two fingers tapped together: undo.
    if (fingers.up(ev)) { endDrag(); undoByTouch(); return; }
    if (drag?.kind === "empty" && !drag.press.panning && ev.type === "pointerup") {
      const { press, adding, at } = drag;
      endDrag();
      tap(at, press.x0, press.y0, adding);
      return;
    }
    if (drag?.kind === "box" && box && boxIsAClick(box)) {
      const { clickAdds, adding, at } = drag, [x0, y0] = [box.x0, box.y0];
      endDrag();
      if (clickAdds) tap(at, x0, y0, adding);
      else if (!adding) editing.selection.clear();
      return;
    }
    endDrag();
  }

  /** A tap on empty space: let go of the selection, or add a tile there. */
  function tap(at: HighwayView, x: number, y: number, adding: boolean): void {
    const does = whatAHighwayTapDoes(at, columns.length, x, y, editing.selection.size > 0, adding);
    if (does.kind === "let-go") editing.selection.clear();
    else addProjectileInColumn(does.seconds, columns[does.column].column);
  }

  // Not onwheel: it must not be passive, or preventDefault cannot stop the page scrolling.
  $effect(() => {
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => canvas.removeEventListener("wheel", wheel);
  });

  function wheel(ev: WheelEvent): void {
    ev.preventDefault();
    if (ev.ctrlKey || ev.metaKey) stretch(ev.deltaY < 0 ? 1.15 : 1 / 1.15);
    else seek(Math.max(0, transport.time - ev.deltaY / practice.highwayPps));
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
