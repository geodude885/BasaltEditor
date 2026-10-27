<script lang="ts">
  // The look preview: a small window, over either layout, showing BossBattles Stage's look on a painted
  // arena - at the playhead as it plays, or where the selected look's fade ends. Drag it by its title;
  // Hit and Health try the edges that answer the fight.
  import { rise } from "./motion";
  import Icon from "./Icon.svelte";
  import {
    isCueForPack, lookCueTimeLabel, STAGE_PACK, stageCueAt, stageLookAfterCue, stageLookAt, stageLookBeforeCue, type StageLook,
  } from "../model/looks";
  import { round } from "../model/tempo";
  import { stageFrameKey } from "../model/stageFrame";
  import { selectLookCue } from "../store/actions";
  import { doc } from "../store/document.svelte";
  import { editor } from "../store/editor.svelte";
  import { layout } from "../store/layout.svelte";
  import { mobile } from "../store/mobile.svelte";
  import { seek } from "../store/playback";
  import { StagePreviewShader } from "../views/stagePreview";

  const HIT_SECONDS = 0.6;
  const SIZES = { small: [256, 144], large: [432, 243] } as const;

  let size = $state<keyof typeof SIZES>("small");
  let follow = $state<"playhead" | "selected">("playhead");
  let health = $state(1);
  let hit = $state(0);
  /** Held down: the arena with no look, to compare. */
  let comparing = $state(false);
  let place = $state<{ x: number; y: number } | null>(null);
  let box: HTMLElement, canvas: HTMLCanvasElement;

  const [width, height] = $derived(SIZES[layout.compact ? "small" : size]);
  const selectedCue = $derived(doc.chart.visuals?.[editor.selectedLookCue]);
  const canFollowSelected = $derived(!!selectedCue && isCueForPack(selectedCue, STAGE_PACK));
  const showingSelected = $derived(follow === "selected" && canFollowSelected);

  const look = $derived.by<StageLook>(() => {
    if (showingSelected) return stageLookAfterCue(stageLookBeforeCue(editor.lookCues, editor.selectedLookCue), selectedCue!);
    return stageLookAt(editor.lookCues, editor.time);
  });
  const now = $derived(stageCueAt(editor.lookCues, editor.time));

  const caption = $derived.by(() => {
    if (showingSelected) return `Where the look at ${lookCueTimeLabel(selectedCue!)} ends up`;
    if (!now) return "No look yet: the player's own";
    const at = lookCueTimeLabel(doc.chart.visuals![now.cue.index]), fading = now.progress < 1 ? ` · ${Math.round(now.progress * 100)}% in` : "";
    if (now.cue.off) return now.progress < 1 ? `Fading back to the player's own${fading}` : "Off: the player's own";
    return `Look at ${at}${fading}`;
  });

  // The arena is painted again only when the key hue moves a whole degree, or the size changes.
  const keyHue = $derived(Math.round(look.settings._KeyHue));

  // Frames are shaded on workers; the editor never waits for one, and the preview drops frames it can't keep up with.
  let shader: StagePreviewShader | null = null;
  $effect(() => {
    const context = canvas.getContext("2d");
    if (!context) return;
    shader = new StagePreviewShader(image => context.putImageData(image, 0, 0));
    return () => { shader?.dispose(); shader = null; };
  });

  // Asks for a frame only when it would differ from the last one asked for: paused, or playing through a look
  // that does not move with the beat, it asks for nothing.
  let asked = "";
  $effect(() => {
    const shown = comparing ? { ...look, on: false } : look;
    const fight = { beatFraction: doc.tempo.ok ? doc.tempo.beat(Math.max(0, editor.time)) % 1 : null, health, hit, time: editor.time };
    const key = `${width}x${height}@${keyHue}|${stageFrameKey(shown, fight)}`;
    if (!shader || key === asked) return;
    shader.shade({ width, height, keyHue, look: shown, fight });
    asked = key;
  });

  // A hit fades out over HIT_SECONDS, frame by frame; another hit starts it again rather than a second fade.
  let hitAt = 0, hitFrame = 0;
  function hitNow(): void {
    const fading = hit > 0;
    hitAt = performance.now();
    const fade = () => {
      hit = Math.max(0, 1 - (performance.now() - hitAt) / 1000 / HIT_SECONDS);
      hitFrame = hit > 0 ? requestAnimationFrame(fade) : 0;
    };
    if (!fading) fade();
  }
  // Closing mid-fade stops it.
  $effect(() => () => cancelAnimationFrame(hitFrame));

  function editShownLook(): void {
    const index = showingSelected ? editor.selectedLookCue : now?.cue.index;
    if (index == null) return;
    selectLookCue(index);
    if (layout.compact) mobile.drawer = "looks";
    if (!showingSelected) seek(now!.cue.time);
  }

  // Dragging by the title bar, kept inside the window.
  let grabbed: { dx: number; dy: number } | null = null;
  function grab(ev: PointerEvent): void {
    if ((ev.target as Element).closest("button")) return;
    const rect = box.getBoundingClientRect();
    grabbed = { dx: ev.clientX - rect.left, dy: ev.clientY - rect.top };
    (ev.currentTarget as Element).setPointerCapture(ev.pointerId);
  }
  function drag(ev: PointerEvent): void {
    if (!grabbed) return;
    const rect = box.getBoundingClientRect();
    place = {
      x: Math.min(window.innerWidth - rect.width, Math.max(0, ev.clientX - grabbed.dx)),
      y: Math.min(window.innerHeight - rect.height, Math.max(0, ev.clientY - grabbed.dy)),
    };
  }
</script>

<aside class="preview" in:rise out:rise class:compact={layout.compact} class:large={!layout.compact && size === "large"} aria-label="Look preview" bind:this={box}
  style:left={place ? `${place.x}px` : null} style:top={place ? `${place.y}px` : null}
  style:right={place ? "auto" : null} style:bottom={place ? "auto" : null}>
  <header role="toolbar" tabindex="-1" onpointerdown={grab} onpointermove={drag} onpointerup={() => { grabbed = null; }}>
    <b>Look preview</b>
    <span class="follow" role="group" aria-label="Show">
      <button aria-pressed={!showingSelected} onclick={() => { follow = "playhead"; }}>Playhead</button>
      <button aria-pressed={showingSelected} disabled={!canFollowSelected} title="Where the selected look's fade ends"
        onclick={() => { follow = "selected"; }}>Selected</button>
    </span>
    {#if !layout.compact}
      <button class="icon" title={size === "small" ? "Larger" : "Smaller"} onclick={() => { size = size === "small" ? "large" : "small"; }}><Icon name={size === "small" ? "expand" : "shrink"} /></button>
    {/if}
    <button class="icon" title="Hide (K)" aria-label="Hide the look preview" onclick={() => editor.toggleLookPreview()}><Icon name="close" /></button>
  </header>

  <div class="screen">
    <canvas bind:this={canvas} {width} {height}
      onpointerdown={() => { comparing = true; }} onpointerup={() => { comparing = false; }} onpointerleave={() => { comparing = false; }}
      title="Hold to see the arena with no look"></canvas>
    <button class="caption" disabled={!showingSelected && !now} onclick={editShownLook} title="Edit this look">
      {comparing ? "No look: the arena as it is" : caption}{showingSelected && !look.on && !comparing ? " (off)" : ""}
    </button>
  </div>

  <footer>
    <button onclick={hitNow} title="The player is hit: the edges flash the danger colour (Hit flash)">Hit</button>
    <label title="The player's health: the edges glow the danger colour as it drops (Low health)">
      <span>Health</span>
      <input type="range" min="0" max="1" step="0.01" value={health} oninput={e => { health = +(e.currentTarget as HTMLInputElement).value; }} />
      <span class="value">{round(health * 100, 0)}%</span>
    </label>
  </footer>
</aside>

<style>
  .preview {
    position: fixed; right: 16px; bottom: 16px; z-index: 20; width: 320px; display: grid;
    background: var(--panel); border: 1px solid var(--line); border-radius: 10px; box-shadow: 0 8px 28px var(--shadow); overflow: hidden;
  }
  .preview.large { width: 560px; }
  .preview.compact { width: min(320px, calc(100vw - 16px)); right: 8px; bottom: 76px; }
  header { display: flex; align-items: center; gap: 6px; padding: 5px 6px 5px 10px; cursor: grab; touch-action: none; user-select: none; border-bottom: 1px solid var(--line); }
  header b { font: 700 13px/1 var(--display); text-transform: uppercase; letter-spacing: .08em; color: var(--text-dim); margin-right: auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  header button { font-size: 11px; padding: 2px 7px; }
  .follow { display: flex; }
  .follow button:first-child { border-radius: 6px 0 0 6px; }
  .follow button:last-child { border-radius: 0 6px 6px 0; border-left: none; }
  .icon { min-width: 24px; }
  .screen { position: relative; }
  canvas { display: block; width: 100%; aspect-ratio: 16 / 9; cursor: zoom-out; touch-action: none; }
  .caption {
    position: absolute; left: 6px; bottom: 6px; max-width: calc(100% - 12px); padding: 2px 8px; font-size: 11px; border-radius: 4px;
    background: color-mix(in srgb, var(--panel) 80%, transparent); border-color: transparent; text-align: left;
  }
  .caption:disabled { opacity: 1; }
  footer { display: flex; align-items: center; gap: 10px; padding: 6px 10px; font-size: 12px; }
  footer button { padding: 2px 10px; font-size: 12px; }
  footer label { display: flex; align-items: center; gap: 6px; flex: 1; color: var(--text-dim); }
  footer input { flex: 1; min-width: 40px; accent-color: var(--bad); }
  .value { font: 11px var(--mono); min-width: 3.5em; text-align: right; }
</style>
