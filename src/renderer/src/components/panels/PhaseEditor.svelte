<script lang="ts">
  // The selected phase: its name, multiplier and start, and the lane colours it switches to.
  import { alphaOf, coloursOf, phaseTime, withAlpha } from "../../model/chart";
  import { LANE_COLOURS, WALL_COLOUR, WALL_DEFAULT } from "../../model/constants";
  import type { Phase, PhaseColours } from "../../model/types";
  import { doc } from "../../store/document.svelte";
  import { editing } from "../../store/editing.svelte";
  import { checked, num, text } from "../fields";

  let { phase, index }: { phase: Phase; index: number } = $props();

  const chartColours = $derived(coloursOf(doc.chart));
  const own = $derived<PhaseColours>(phase.colours ?? phase.colors ?? {});
  const walls = $derived(own.walls);
  const wallMode = $derived(walls == null ? "chart" : walls === "none" ? "hide" : "show");
  /** What the wall controls show: the phase's own walls, else the chart's. */
  const shownWalls = $derived(wallMode === "show" ? walls! : chartColours.walls ?? WALL_DEFAULT);

  const edit = (mutate: (p: Phase) => void) => doc.change(["phases"], () => mutate(doc.chart.phases![index]));

  function setColours(next: PhaseColours): void {
    edit(p => {
      delete p.colors;
      if (Object.keys(next).length) p.colours = next; else delete p.colours;
    });
  }

  function setColour(key: string, value: string | undefined): void {
    const next: Record<string, string | undefined> = { ...own };
    if (value) next[key] = value; else delete next[key];
    setColours(next as PhaseColours);
  }

  function setWalls(mode: string, colour: string, alpha: number): void {
    const next = { ...own };
    if (mode === "hide") next.walls = "none";
    else if (mode === "show") next.walls = withAlpha(colour, alpha || 0.2);
    else delete next.walls;
    setColours(next);
  }

  function remove(): void {
    doc.change(["phases"], () => { doc.chart.phases!.splice(index, 1); });
    editing.selectedPhase = -1;
  }
</script>

<h3>Phase</h3>
<div class="grid3">
  <label><span>Name</span><input value={phase.name ?? ""} onchange={e => edit(p => { p.name = text(e); })} /></label>
  <label><span>Score ×</span>
    <input type="number" step="0.5" min="0.5" value={phase.scoreMultiplier ?? 1}
      onchange={e => edit(p => { const m = num(e); if (m && m !== 1) p.scoreMultiplier = m; else delete p.scoreMultiplier; })} />
  </label>
  <label><span>Starts (s)</span>
    <input type="number" step="0.5" value={phaseTime(phase, doc.tempo)} disabled={index === 0}
      onchange={e => edit(p => { delete p.startBeat; p.start = Math.max(0, num(e) || 0); })} />
  </label>
</div>
<div class="row">
  {#if index > 0}<button onclick={remove}>Delete phase</button>{/if}
  <span class="note">Hits on actors score × the multiplier during this phase.</span>
</div>

<h3>Lane colours from this phase</h3>
<div class="grid2">
  {#each LANE_COLOURS as [key, label, mine] (key)}
    {@const value = (own[key] ?? chartColours[key] ?? mine).slice(0, 7)}
    <label>
      <span><input type="checkbox" checked={!!own[key]} onchange={e => setColour(key, checked(e) ? value : undefined)} /> {label}</span>
      <input type="color" {value} disabled={!own[key]} onchange={e => setColour(key, text(e))} />
    </label>
  {/each}
</div>
<div class="grid3">
  <label><span>Walls</span>
    <select value={wallMode} onchange={e => setWalls(text(e), shownWalls.slice(0, 7), alphaOf(shownWalls))}>
      <option value="chart">as the chart</option><option value="show">shown</option><option value="hide">hidden</option>
    </select>
  </label>
  <label><span>Wall colour</span>
    <input type="color" value={(wallMode === "show" ? walls! : chartColours.walls ?? WALL_COLOUR).slice(0, 7)} disabled={wallMode !== "show"}
      onchange={e => setWalls("show", text(e), alphaOf(shownWalls))} />
  </label>
  <label><span>Wall opacity</span>
    <input type="range" min="0.05" max="0.8" step="0.05" value={alphaOf(shownWalls)} disabled={wallMode !== "show"}
      onchange={e => setWalls("show", shownWalls.slice(0, 7), num(e))} />
  </label>
</div>
<div class="note">Ticked colours replace the chart's from this phase on; the lane fades to them over a second.</div>
