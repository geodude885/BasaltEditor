<script lang="ts">
  import { alphaOf, coloursOf, endOf, laneOf, zoneOf } from "../../model/chart";
  import { DIFFICULTIES, LANE_COLOURS, MAPS, WALL_COLOUR, WALL_DEFAULT } from "../../model/constants";
  import {
    resizeLane, setArenaSpot, setLaneColour, setMusic, setRules, setTopLevelValueOrRemoveIfEmpty, setWallsShown, setZone,
  } from "../../model/edits";
  import { density } from "../../model/problems";
  import { round } from "../../model/tempo";
  import type { LoadedChart } from "../../model/types";
  import { endWithSong, toast } from "../../store/actions";
  import { doc } from "../../store/document.svelte";
  import { editor } from "../../store/editor.svelte";
  import { chooseCover, newChart } from "../../store/files";
  import SongPicker from "../SongPicker.svelte";
  import { songLength } from "../../store/playback";
  import { checked, num, optionalNum, text } from "../fields";

  const c = $derived(doc.chart);
  const lane = $derived(laneOf(c));
  const arena = $derived(c.arena ?? { map: "here" as const });
  const stats = $derived(density(c, doc.tempo));
  const end = $derived(endOf(c, doc.tempo));
  const colours = $derived(coloursOf(c));
  const song = $derived(editor.song?.buffer ? songLength() : null);
  const walls = $derived(colours.walls);
  const m = $derived(c.music);

  const set = <K extends keyof LoadedChart>(key: K, value: LoadedChart[K] | undefined | "") =>
    doc.change([key], () => setTopLevelValueOrRemoveIfEmpty(c, key, value));
  const changeColours = (mutate: () => void) => doc.change(["colours", "colors"], mutate);

  function setLength(length: number): void {
    if (!(length > 2) || Math.abs(length - lane.length) < 0.001) return;
    doc.change([], () => resizeLane(c, length));
    toast(`Lane ${length} m - everything along it moved with it`);
  }
</script>

{#if editor.confirmNew}
  <div class="confirm">
    Start a new chart? Unsaved changes to this one stay only in the editor's draft.
    <button class="primary" onclick={() => { editor.confirmNew = false; newChart(); }}>Start new</button>
    <button onclick={() => { editor.confirmNew = false; }}>Keep editing</button>
  </div>
{/if}

<div class="cards">
  <div class="stat"><b>{stats.shots}</b><span>projectiles</span></div>
  <div class="stat"><b>{stats.average.toFixed(2)}</b><span>per second</span></div>
  <div class="stat"><b>{stats.peak.toFixed(1)}</b><span>busiest 2 s, per s</span></div>
  <div class="stat"><b>{round(end, 1)}s</b><span>long</span></div>
</div>

<h3>About</h3>
<div class="grid2">
  <label><span>Name</span><input value={c.name ?? ""} onchange={e => set("name", text(e))} /></label>
  <label><span>Author</span><input value={c.author ?? ""} onchange={e => set("author", text(e))} /></label>
  <label><span>Difficulty</span>
    <input list="difficulties" value={c.difficulty ?? ""} onchange={e => set("difficulty", text(e))} />
    <datalist id="difficulties">{#each DIFFICULTIES as d (d)}<option>{d}</option>{/each}</datalist>
  </label>
  <label><span>Ends at (s)</span><input type="number" step="0.5" value={c.end ?? ""} placeholder="3 s after the last event" onchange={e => set("end", optionalNum(e))} /></label>
</div>
<label><span>Description</span><input value={c.description ?? ""} onchange={e => set("description", text(e))} /></label>
{#if song != null && song - end > 1}
  <div class="confirm">The battle ends at {round(end, 1)} s, but the song runs to {round(song, 1)} s. <button onclick={endWithSong}>End with the song</button></div>
{/if}

<h3>Arena and lane</h3>
<div class="grid3">
  <label><span>Map</span>
    <select value={(arena.map ?? "here").toLowerCase()} onchange={e => doc.change(["arena"], () => { c.arena = { map: text(e) as (typeof MAPS)[number] }; })}>
      {#each MAPS as m (m)}<option>{m}</option>{/each}
    </select>
  </label>
  <label><span>Length m</span><input type="number" step="1" min="3" value={lane.length} onchange={e => setLength(num(e))} /></label>
  <label><span>Width m</span><input type="number" step="0.5" min="1" value={lane.width} onchange={e => doc.change(["lane"], () => { c.lane = { length: lane.length, width: num(e) }; })} /></label>
</div>
{#if (arena.map ?? "here") !== "here"}
  <div class="grid3">
    <label><span>Start x</span><input type="number" step="0.1" value={arena.at?.x ?? ""} placeholder="laid across the middle" onchange={e => doc.change(["arena"], () => setArenaSpot(c, optionalNum(e), arena.at?.z, arena.facing))} /></label>
    <label><span>Start z</span><input type="number" step="0.1" value={arena.at?.z ?? ""} onchange={e => doc.change(["arena"], () => setArenaSpot(c, arena.at?.x, optionalNum(e), arena.facing))} /></label>
    <label><span>Facing °</span><input type="number" step="5" value={arena.facing ?? ""} placeholder="north" onchange={e => doc.change(["arena"], () => setArenaSpot(c, arena.at?.x, arena.at?.z, optionalNum(e)))} /></label>
  </div>
  <div class="note">Easiest in game: Chart editing on, then SETUP on the picker - walk the lane and SAVE.</div>
{/if}

<h3>Your zone and rules</h3>
<div class="grid3">
  <label><span>Zone length m</span><input type="number" step="0.5" min="0.5" value={c.zone?.length ?? ""} placeholder={String(zoneOf(c).length)} onchange={e => doc.change(["zone"], () => setZone(c, optionalNum(e), c.zone?.height))} /></label>
  <label><span>Zone height m</span><input type="number" step="0.5" min="1" value={c.zone?.height ?? ""} placeholder="3.5" onchange={e => doc.change(["zone"], () => setZone(c, c.zone?.length, optionalNum(e)))} /></label>
  <label><span>Clean up still structures after s</span><input type="number" step="0.5" min="0" value={c.rules?.cleanup ?? ""} placeholder="3 (0 = never)" onchange={e => doc.change(["rules"], () => setRules(c, c.rules?.spawn ?? "all", optionalNum(e)))} /></label>
  <label><span>You may spawn</span>
    <select value={(c.rules?.spawn ?? "all").toLowerCase()} onchange={e => doc.change(["rules"], () => setRules(c, text(e), c.rules?.cleanup))}>
      <option value="all">everything</option><option value="discs">discs only</option><option value="none">nothing - moves only</option>
    </select>
  </label>
</div>
<div class="note">You cannot go past the zone's line or above its height. Structures and actors pass through both.</div>

<h3>Lane colours</h3>
<div class="grid2">
  {#each LANE_COLOURS as [key, label, mine] (key)}
    <label>
      <span>{label}{#if colours[key]} <a href="#default" onclick={e => { e.preventDefault(); changeColours(() => setLaneColour(c, key, undefined)); }}>default</a>{/if}</span>
      <input type="color" value={(colours[key] ?? mine).slice(0, 7)} onchange={e => changeColours(() => setLaneColour(c, key, text(e)))} />
    </label>
  {/each}
</div>
<div class="grid3">
  <label><span>Show walls</span><input type="checkbox" checked={!!walls} onchange={e => changeColours(() => setWallsShown(c, checked(e), (walls ?? WALL_COLOUR).slice(0, 7), alphaOf(walls ?? WALL_DEFAULT)))} /></label>
  <label><span>Wall colour</span><input type="color" disabled={!walls} value={(walls ?? WALL_COLOUR).slice(0, 7)} onchange={e => changeColours(() => setWallsShown(c, true, text(e), alphaOf(walls)))} /></label>
  <label><span>Wall opacity {Math.round(alphaOf(walls ?? WALL_DEFAULT) * 100)}%</span>
    <input type="range" min="0.05" max="0.8" step="0.05" disabled={!walls} value={alphaOf(walls ?? WALL_DEFAULT)} onchange={e => changeColours(() => setWallsShown(c, true, (walls ?? WALL_COLOUR).slice(0, 7), num(e)))} />
  </label>
</div>
<div class="note">Walls are invisible unless shown: then a see-through pane marks each one, as high as your zone.</div>

<h3>Song and cover</h3>
<SongPicker />
<div class="grid2">
  <label><span>Chart starts at song s</span><input type="number" step="0.01" value={m?.start ?? 0} onchange={e => doc.change(["music"], () => setMusic(c, m?.file ?? "", num(e), m?.volume ?? 1))} /></label>
  <label><span>Volume</span><input type="number" step="0.05" min="0" max="1" value={m?.volume ?? 1} onchange={e => doc.change(["music"], () => setMusic(c, m?.file ?? "", m?.start ?? 0, num(e)))} /></label>
</div>
<div class="grid2">
  <div class="cover">
    <label><span>Cover image</span><input value={c.cover ?? ""} placeholder="cover.png" onchange={e => set("cover", text(e).trim() || undefined)} /></label>
    <button onclick={chooseCover}>{c.cover ? "Change cover…" : "Choose cover…"}</button>
  </div>
  {#if editor.cover}
    <img src={editor.cover} alt="Cover" />
  {:else}
    <div class="note">Choose a PNG or JPEG to see it here.</div>
  {/if}
</div>

<style>
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
  .stat { display: grid; gap: 2px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; }
  .stat b { font: 600 20px var(--mono); font-variant-numeric: tabular-nums; }
  .stat span { font-size: 11px; color: var(--text-dim); text-transform: uppercase; letter-spacing: .05em; }
  img { max-height: 96px; max-width: 100%; border-radius: 6px; }
  .cover { display: grid; gap: 6px; align-content: start; }
</style>
