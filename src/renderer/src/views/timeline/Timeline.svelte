<script lang="ts">
  // The chart over time. Click the ruler or waveform to seek, a phase or look to edit it, an event to
  // select it; drag events to move them, drag empty rows to box-select, double-click a row to add there.
  // With a finger, empty space waits to see what a press becomes: a tap adds there (a projectile in
  // the column tapped), a drag pans, a long press box-selects; two fingers pinch and pan.
  import Icon from "../../components/Icon.svelte";
  import { evTime, setEvTime } from "../../model/chart";
  import type { ChartEvent } from "../../model/types";
  import {
    addMove, addProjectile, addProjectileInColumn, addStageCueAtPlayhead, pickCycled, select, selectLookCue, selectPhase, setExtraTimelineHeight, toggleTimelineRow, zoom,
    undoByTouch,
  } from "../../store/actions";
  import { doc } from "../../store/document.svelte";
  import { appearance } from "../../store/appearance.svelte";
  import { display } from "../../store/display.svelte";
  import { editing } from "../../store/editing.svelte";
  import { session } from "../../store/session.svelte";
  import { transport } from "../../store/transport.svelte";
  import { ui } from "../../store/ui.svelte";
  import { keepPlayheadInView, seek, songOffset } from "../../store/playback";
  import { practice } from "../../store/practice.svelte";
  import { untrack } from "svelte";
  import { boxIsAClick, prepare, theme, type Box } from "../theme";
  import { drawPlayhead, drawTimeline } from "./draw";
  import { performanceRows } from "../../model/performances";
  import { clipLaneSpan, COLLAPSIBLE_ROWS, eventSpots, layoutTimeline, placeMarkers, tOf } from "./geometry";
  import { markersInBox, pressWaitsOnTouch, touchTapWith, whatATimelinePressHits, whatATouchTapAdds, type TouchTap } from "./interaction";
  import { dragStartsAfterPixels, Fingers, restingFinger, Taps, WaitingPress, type PinchStep } from "../touch";

  let canvas: HTMLCanvasElement;
  let w = $state(0);
  type Drag =
    | { kind: "seek" }
    | { kind: "box"; adding: boolean; addsTo: number[] }
    // `hold`: a finger resting on the markers opens quick actions for them.
    | { kind: "move"; startSeconds: number; textBefore: string; startTimes: [ChartEvent, number][]; moved: boolean; slop: number; hold?: WaitingPress }
    | { kind: "touch"; press: WaitingPress; t0: number; tap: TouchTap; adding: boolean };
  let drag: Drag | null = null;
  let box = $state<Box | null>(null);

  // The recorded-clips row has a lane per performance, labelled with its actor.
  const performanceLanes = $derived(performanceRows(doc.chart));
  const layout = $derived(layoutTimeline(display.collapsedTimelineRows, display.extraTimelineHeightPixels, { performances: performanceLanes.length, shotColumns: display.highwayColumns }));
  // The events' times and rows only when the chart changes; their places as the view moves.
  const spots = $derived(eventSpots(doc.chart, doc.tempo, layout));
  const placed = $derived(placeMarkers(spots, display.timeline));

  $effect(() => { display.timelineWidth = w; });
  // Showing again (say, after the highway moved the playhead): start where the playhead is.
  $effect(() => { if (w) untrack(keepPlayheadInView); });

  // Everything but the playhead, drawn off screen and kept until something it shows changes - it reads
  // no playhead, so playing doesn't redraw it. Each frame then copies it and draws the playhead over it.
  const still = typeof document === "undefined" ? null : document.createElement("canvas");
  const stillLayer = $derived.by(() => {
    if (!w || !still) return null;
    drawTimeline(prepare(still, w, layout.height), w, layout.height, {
      chart: doc.chart, tempo: doc.tempo, view: display.timeline, snap: editing.snap,
      selection: editing.selection, selectedPhase: editing.selectedPhase, lookCues: doc.lookCues, selectedLookCue: editing.selectedLookCue, shotColouring: display.shotColouring,
      markers: placed, song: session.song, songOffset: songOffset(), clips: session.clips, performanceRows: performanceLanes, box, layout, loop: practice.loop, loopStart: practice.loopStart,
    }, theme(appearance.scheme));
    return { canvas: still };
  });

  $effect(() => {
    if (!stillLayer) return;
    const ctx = prepare(canvas, w, layout.height);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(stillLayer.canvas, 0, 0); ctx.restore();
    drawPlayhead(ctx, layout.height, display.timeline, transport.time, theme(appearance.scheme));
  });

  const secondsAt = (x: number) => tOf(display.timeline, x);
  const snapped = (seconds: number) => doc.tempo.snap(seconds, editing.snap);
  const pointerAt = (ev: PointerEvent | WheelEvent): [number, number] => { const r = canvas.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };

  const taps = new Taps(), fingers = new Fingers("x");
  /** Shift, or the touch screens' multi-select button, adds to the selection. */
  const adds = (ev: PointerEvent) => ev.shiftKey || editing.multiSelect;

  /** A finger lifted without moving: do what the tap means there. */
  function touchTap(d: Extract<Drag, { kind: "touch" }>): void {
    const t = secondsAt(d.press.x0), tap = touchTapWith(d.tap, editing.selection.size > 0, d.adding);
    switch (tap.kind) {
      case "let-go": editing.selection.clear(); return;
      case "add-projectile": addProjectileInColumn(t, tap.column, layout.shotColumns); return;
      case "add-look-cue": seek(snapped(t)); addStageCueAtPlayhead(); return;
      case "add-move": seek(snapped(t)); addMove(); return;
      case "seek-and-clear-selection":
        if (!d.adding) editing.selection.clear();
        seek(Math.max(0, t));
    }
  }

  function pinchStep({ zoom: factor, atX, panX }: PinchStep): void {
    display.timeline.t0 = Math.max(-1, display.timeline.t0 - panX / display.timeline.pps);
    zoom(factor, atX);
  }

  function pointerdown(ev: PointerEvent): void {
    const [x, y] = pointerAt(ev);
    canvas.setPointerCapture(ev.pointerId);
    if (fingers.down(ev, x, y)) {
      // A second finger: the first one's press becomes a pinch. Keep a move already made; drop a box.
      if (drag?.kind === "move") pointerup();
      else { if (drag?.kind === "touch") drag.press.end(); drag = null; box = null; }
      return;
    }
    if (fingers.busy) return;
    const press = whatATimelinePressHits(doc.chart, doc.tempo, display.timeline, layout, placed, doc.lookCues, x, y, taps.isDouble(ev));
    // Select mode: empty space boxes straight away, with any pointer.
    if (editing.selectMode && pressWaitsOnTouch(press, layout, y)) {
      drag = { kind: "box", adding: adds(ev), addsTo: adds(ev) ? [...editing.selection] : [] };
      box = { x0: x, y0: y, x1: x, y1: y };
      return;
    }
    if (ev.pointerType === "touch" && pressWaitsOnTouch(press, layout, y)) {
      const adding = adds(ev);
      // Held still: box-select from here.
      const d: Extract<Drag, { kind: "touch" }> = {
        kind: "touch", t0: display.timeline.t0, tap: whatATouchTapAdds(layout, y), adding,
        press: new WaitingPress(x, y, () => {
          if (drag !== d) return;
          drag = { kind: "box", adding, addsTo: adding ? [...editing.selection] : [] };
          box = { x0: x, y0: y, x1: x, y1: y };
        }),
      };
      drag = d;
      return;
    }
    switch (press.kind) {
      case "select-phase": selectPhase(press.index); return;
      case "select-look-cue": selectLookCue(press.index); return;
      case "add-look-cue": seek(snapped(secondsAt(x))); addStageCueAtPlayhead(); return;
      case "add-projectile": seek(snapped(secondsAt(x))); addProjectile(); return;
      case "add-move": seek(snapped(secondsAt(x))); addMove(); return;
      case "select-events": {
        const hit = pickCycled(press.underPointer, "timeline", x, y);
        if (!editing.selection.has(hit)) select(hit, adds(ev));
        const events = doc.chart.events, at = { x: ev.clientX, y: ev.clientY };
        const d: Extract<Drag, { kind: "move" }> = {
          kind: "move", startSeconds: secondsAt(x), textBefore: doc.text, moved: false, slop: dragStartsAfterPixels(ev.pointerType),
          startTimes: [...editing.selection].map(i => [events[i], evTime(events[i], doc.tempo)]),
        };
        d.hold = restingFinger(ev, x, y, () => { if (drag === d && !d.moved) { drag = null; ui.quickActions = at; } });
        drag = d;
        return;
      }
      case "box-select":
        drag = { kind: "box", adding: adds(ev), addsTo: adds(ev) ? [...editing.selection] : [] };
        box = { x0: x, y0: y, x1: x, y1: y };
        return;
      case "seek-and-clear-selection":
        if (!adds(ev)) editing.selection.clear();
        seek(Math.max(0, secondsAt(x)));
        drag = { kind: "seek" };
        return;
      case "seek":
        seek(Math.max(0, secondsAt(x)));
        drag = { kind: "seek" };
    }
  }

  function pointermove(ev: PointerEvent): void {
    const [x, y] = pointerAt(ev);
    const step = fingers.move(ev, x, y);
    if (step) { pinchStep(step); return; }
    if (!drag) return;
    if (drag.kind === "touch") {
      if (drag.press.pans(x, y)) display.timeline.t0 = Math.max(-1, drag.t0 - (x - drag.press.x0) / display.timeline.pps);
    } else if (drag.kind === "box") {
      if (!box) return;
      box = { ...box, x1: x, y1: y };
      editing.setSelection(new Set([...drag.addsTo, ...markersInBox(placed, box)]));
    } else if (drag.kind === "seek") {
      seek(Math.max(0, secondsAt(x)));
    } else {
      drag.hold?.pans(x, y);
      const deltaSeconds = secondsAt(x) - drag.startSeconds;
      if (!drag.moved && Math.abs(deltaSeconds * display.timeline.pps) < drag.slop) return;
      drag.moved = true;
      for (const [e, from] of drag.startTimes) setEvTime(e, snapped(from + deltaSeconds), doc.tempo);
    }
  }

  function pointerup(ev?: PointerEvent): void {
    // Two fingers tapped together: undo, once the rest of this lift is done.
    const twoTapped = !!ev && fingers.up(ev);
    if (drag?.kind === "move") drag.hold?.end();
    if (drag?.kind === "touch") {
      drag.press.end();
      if (!drag.press.panning && ev?.type === "pointerup") touchTap(drag);
    } else if (drag?.kind === "box" && box) {
      if (boxIsAClick(box)) {
        if (!drag.adding) editing.selection.clear();
        seek(Math.max(0, secondsAt(box.x0)));
      }
      editing.selectedPhase = -1;
    } else if (drag?.kind === "move" && drag.moved) {
      const moved = drag.startTimes.map(([e]) => e);
      doc.commit(drag.textBefore, ["events"]);
      editing.setSelection(moved.map(e => doc.chart.events.indexOf(e)));
    }
    drag = null;
    box = null;
    if (twoTapped) undoByTouch();
  }

  // Not onwheel: it must not be passive, or preventDefault cannot stop the page scrolling.
  $effect(() => {
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => canvas.removeEventListener("wheel", wheel);
  });

  function wheel(ev: WheelEvent): void {
    ev.preventDefault();
    const [x] = pointerAt(ev);
    if (ev.ctrlKey || ev.metaKey) zoom(ev.deltaY < 0 ? 1.25 : 0.8, x);
    else display.timeline.t0 = Math.max(-1, display.timeline.t0 + (ev.deltaX || ev.deltaY) / display.timeline.pps);
  }

  let resizing: { startY: number; startExtraPixels: number } | null = null;

  function startResizing(ev: PointerEvent): void {
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    resizing = { startY: ev.clientY, startExtraPixels: display.extraTimelineHeightPixels };
  }

  function resize(ev: PointerEvent): void {
    if (resizing) setExtraTimelineHeight(resizing.startExtraPixels + ev.clientY - resizing.startY);
  }

  function stopResizing(): void {
    if (resizing) display.rememberTimelineLayout();
    resizing = null;
  }
</script>

<div class="timeline">
  <div class="row-headers" style:height="{layout.height}px">
    {#each COLLAPSIBLE_ROWS as { row, label } (row)}
      {@const [top, height] = layout.rows[row]}
      {@const collapsed = layout.collapsed.has(row)}
      <button class="row-header" class:collapsed style:top="{top}px" style:height="{height}px" aria-expanded={!collapsed}
        title={collapsed ? `Show ${label.toLowerCase()}` : `Collapse ${label.toLowerCase()} to a thin strip`} onclick={() => toggleTimelineRow(row)}>
        <span class="chevron"><Icon name={collapsed ? "right" : "down"} size="10px" /></span>{collapsed || (row === "clip" && performanceLanes.length) ? "" : label}
      </button>
    {/each}
    {#if performanceLanes.length && !layout.collapsed.has("clip")}
      {#each performanceLanes as lane, i (lane.performance)}
        {@const [top, height] = clipLaneSpan(layout, i)}
        <span class="lane-label" style:top="{top}px" style:height="{height}px" style:line-height="{height}px" title="Recorded clips: {lane.label}">{lane.label}</span>
      {/each}
    {/if}
  </div>
  <div class="canvas" bind:clientWidth={w}>
    <canvas
      bind:this={canvas}
      style:height="{layout.height}px"
      onpointerdown={pointerdown}
      onpointermove={pointermove}
      onpointerup={pointerup}
      onpointercancel={pointerup}
      aria-label="Timeline: song waveform, beats, phases, looks, projectiles, moves and recorded clips"
    ></canvas>
  </div>
  <div class="resize-handle" role="separator" aria-orientation="horizontal" aria-label="Drag to make the timeline taller or shorter"
    title="Drag to make the timeline taller or shorter; double-click to reset"
    onpointerdown={startResizing} onpointermove={resize} onpointerup={stopResizing}
    ondblclick={() => { setExtraTimelineHeight(0); display.rememberTimelineLayout(); }}></div>
</div>

<style>
  .timeline { display: grid; grid-template-columns: 108px minmax(0, 1fr); border-bottom: 1px solid var(--line); }
  .row-headers { position: relative; border-right: 1px solid var(--line); background: var(--bg); }
  .row-header {
    position: absolute; left: 0; right: 0; display: flex; align-items: center; gap: 4px; padding: 0 6px; border: 0;
    border-radius: 0; background: none; color: var(--text-dim); font: 600 10px var(--body); text-transform: uppercase;
    letter-spacing: .05em; text-align: left; overflow: hidden;
  }
  .row-header:hover { color: var(--text); background: color-mix(in srgb, var(--wash) 3%, transparent); }
  .row-header.collapsed { font-size: 9px; }
  .chevron { font-size: 9px; width: 9px; flex: none; }
  /* Over the recorded row's header, clear of its chevron; a press goes through to the header. */
  .lane-label {
    position: absolute; left: 19px; right: 4px; pointer-events: none; overflow: hidden;
    color: var(--text-dim); font: 600 10px var(--body); white-space: nowrap; text-overflow: ellipsis;
  }
  .canvas { min-width: 0; }
  canvas { width: 100%; display: block; touch-action: none; }
  .resize-handle { grid-column: 1 / -1; height: 6px; cursor: row-resize; background: var(--line); touch-action: none; }
  .resize-handle:hover { background: var(--text-dim); }
</style>
