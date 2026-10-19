<script lang="ts">
  // The chart over time. Click the ruler or waveform to seek, a phase or look to edit it, an event to
  // select it; drag events to move them, drag empty rows to box-select, double-click a row to add there.
  import { evTime, setEvTime } from "../../model/chart";
  import type { ChartEvent } from "../../model/types";
  import {
    addMove, addProjectile, addStageCueAtPlayhead, pickCycled, select, selectLookCue, selectPhase, setExtraTimelineHeight, toggleTimelineRow, zoom,
  } from "../../store/actions";
  import { doc } from "../../store/document.svelte";
  import { appearance } from "../../store/appearance.svelte";
  import { editor } from "../../store/editor.svelte";
  import { seek, songStart } from "../../store/playback";
  import { boxIsAClick, prepare, theme, type Box } from "../theme";
  import { drawTimeline } from "./draw";
  import { COLLAPSIBLE_ROWS, layoutTimeline, markers, tOf } from "./geometry";
  import { DRAG_STARTS_AFTER_PIXELS, markersInBox, whatATimelinePressHits } from "./interaction";

  let canvas: HTMLCanvasElement;
  let w = $state(0);
  type Drag =
    | { kind: "seek" }
    | { kind: "box"; adding: boolean; addsTo: number[] }
    | { kind: "move"; startSeconds: number; textBefore: string; startTimes: [ChartEvent, number][]; moved: boolean };
  let drag: Drag | null = null;
  let box = $state<Box | null>(null);

  const layout = $derived(layoutTimeline(editor.collapsedTimelineRows, editor.extraTimelineHeightPixels));
  const placed = $derived(markers(doc.chart, doc.tempo, editor.view, layout));

  $effect(() => { editor.timelineWidth = w; });

  $effect(() => {
    if (!w) return;
    drawTimeline(prepare(canvas, w, layout.height), w, layout.height, {
      chart: doc.chart, tempo: doc.tempo, view: editor.view, time: editor.time, snap: editor.snap,
      selection: editor.selection, selectedPhase: editor.selectedPhase, lookCues: editor.lookCues, selectedLookCue: editor.selectedLookCue,
      markers: placed, song: editor.song, songStart: songStart(), clips: editor.clips, box, layout,
    }, theme(appearance.scheme));
  });

  const secondsAt = (x: number) => tOf(editor.view, x);
  const snapped = (seconds: number) => doc.tempo.snap(seconds, editor.snap);
  const pointerAt = (ev: PointerEvent | WheelEvent): [number, number] => { const r = canvas.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };

  function pointerdown(ev: PointerEvent): void {
    const [x, y] = pointerAt(ev);
    canvas.setPointerCapture(ev.pointerId);
    const press = whatATimelinePressHits(doc.chart, doc.tempo, editor.view, layout, placed, editor.lookCues, x, y, ev.detail === 2);
    switch (press.kind) {
      case "select-phase": selectPhase(press.index); return;
      case "select-look-cue": selectLookCue(press.index); return;
      case "add-look-cue": seek(snapped(secondsAt(x))); addStageCueAtPlayhead(); return;
      case "add-projectile": seek(snapped(secondsAt(x))); addProjectile(); return;
      case "add-move": seek(snapped(secondsAt(x))); addMove(); return;
      case "select-events": {
        const hit = pickCycled(press.underPointer, "timeline", x, y);
        if (!editor.selection.has(hit)) select(hit, ev.shiftKey);
        const events = doc.chart.events;
        drag = {
          kind: "move", startSeconds: secondsAt(x), textBefore: doc.text, moved: false,
          startTimes: [...editor.selection].map(i => [events[i], evTime(events[i], doc.tempo)]),
        };
        return;
      }
      case "box-select":
        drag = { kind: "box", adding: ev.shiftKey, addsTo: ev.shiftKey ? [...editor.selection] : [] };
        box = { x0: x, y0: y, x1: x, y1: y };
        return;
      case "seek-and-clear-selection":
        if (!ev.shiftKey) editor.selection.clear();
        seek(Math.max(0, secondsAt(x)));
        drag = { kind: "seek" };
        return;
      case "seek":
        seek(Math.max(0, secondsAt(x)));
        drag = { kind: "seek" };
    }
  }

  function pointermove(ev: PointerEvent): void {
    if (!drag) return;
    const [x, y] = pointerAt(ev);
    if (drag.kind === "box") {
      if (!box) return;
      box = { ...box, x1: x, y1: y };
      editor.setSelection(new Set([...drag.addsTo, ...markersInBox(placed, box)]));
    } else if (drag.kind === "seek") {
      seek(Math.max(0, secondsAt(x)));
    } else {
      const deltaSeconds = secondsAt(x) - drag.startSeconds;
      if (!drag.moved && Math.abs(deltaSeconds * editor.view.pps) < DRAG_STARTS_AFTER_PIXELS) return;
      drag.moved = true;
      for (const [e, from] of drag.startTimes) setEvTime(e, snapped(from + deltaSeconds), doc.tempo);
    }
  }

  function pointerup(): void {
    if (drag?.kind === "box" && box) {
      if (boxIsAClick(box)) {
        if (!drag.adding) editor.selection.clear();
        seek(Math.max(0, secondsAt(box.x0)));
      }
      editor.selectedPhase = -1;
    } else if (drag?.kind === "move" && drag.moved) {
      const moved = drag.startTimes.map(([e]) => e);
      doc.commit(drag.textBefore, ["events"]);
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
    const [x] = pointerAt(ev);
    if (ev.ctrlKey || ev.metaKey) zoom(ev.deltaY < 0 ? 1.25 : 0.8, x);
    else editor.view.t0 = Math.max(-1, editor.view.t0 + (ev.deltaX || ev.deltaY) / editor.view.pps);
  }

  let resizing: { startY: number; startExtraPixels: number } | null = null;

  function startResizing(ev: PointerEvent): void {
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    resizing = { startY: ev.clientY, startExtraPixels: editor.extraTimelineHeightPixels };
  }

  function resize(ev: PointerEvent): void {
    if (resizing) setExtraTimelineHeight(resizing.startExtraPixels + ev.clientY - resizing.startY);
  }

  function stopResizing(): void {
    if (resizing) editor.rememberTimelineLayout();
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
        <span class="chevron">{collapsed ? "▸" : "▾"}</span>{collapsed ? "" : label}
      </button>
    {/each}
  </div>
  <div class="canvas" bind:clientWidth={w}>
    <canvas
      bind:this={canvas}
      style:height="{layout.height}px"
      onpointerdown={pointerdown}
      onpointermove={pointermove}
      onpointerup={pointerup}
      aria-label="Timeline: song waveform, beats, phases, looks, projectiles, moves and recorded clips"
    ></canvas>
  </div>
  <div class="resize-handle" role="separator" aria-orientation="horizontal" aria-label="Drag to make the timeline taller or shorter"
    title="Drag to make the timeline taller or shorter; double-click to reset"
    onpointerdown={startResizing} onpointermove={resize} onpointerup={stopResizing}
    ondblclick={() => { setExtraTimelineHeight(0); editor.rememberTimelineLayout(); }}></div>
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
  .canvas { min-width: 0; }
  canvas { width: 100%; display: block; touch-action: none; }
  .resize-handle { grid-column: 1 / -1; height: 6px; cursor: row-resize; background: var(--line); touch-action: none; }
  .resize-handle:hover { background: var(--text-dim); }
</style>
