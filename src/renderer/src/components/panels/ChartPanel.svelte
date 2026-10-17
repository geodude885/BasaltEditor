<script lang="ts">
  import { alphaOf, coloursOf, endOf, laneOf, withAlpha, zoneOf } from "../../model/chart";
  import { DIFFICULTIES, LANE_COLOURS, MAPS, WALL_COLOUR, WALL_DEFAULT } from "../../model/constants";
  import { resizeLane } from "../../model/edits";
  import { density } from "../../model/problems";
  import { round } from "../../model/tempo";
  import type { LaneColours, LoadedChart } from "../../model/types";
  import { endWithSong, toast } from "../../store/actions";
  import { doc } from "../../store/document.svelte";
  import { editor } from "../../store/editor.svelte";
  import { newChart } from "../../store/files";
  import { songLength } from "../../store/playback";
  import { checked, num, optionalNum, text } from "../fields";
  import PhaseEditor from "./PhaseEditor.svelte";

  const c = $derived(doc.chart);
  const lane = $derived(laneOf(c));
  const arena = $derived(c.arena ?? { map: "here" as const });
  const stats = $derived(density(c, doc.tempo));
  const end = $derived(endOf(c, doc.tempo));
  const colours = $derived(coloursOf(c));
  const phase = $derived(editor.selectedPhase >= 0 ? c.phases?.[editor.selectedPhase] : undefined);
  const song = $derived(editor.song?.buffer ? songLength() : null);
  const walls = $derived(colours.walls);
  const m = $derived(c.music);

  /** Sets a top-level key; empty values remove it. */
  function set<K extends keyof LoadedChart>(key: K, value: LoadedChart[K] | undefined | ""): void {
    doc.change([key], () => {
      if (value === undefined || value === "" || (typeof value === "number" && Number.isNaN(value))) delete c[key];
      else c[key] = value;
    });
  }

  function setColours(next: LaneColours): void {
    doc.change(["colours", "colors"], () => {
      delete c.colors;
      if (Object.keys(next).length) c.colours = next; else delete c.colours;
    });
  }

  function setLaneColour(key: string, value: string | undefined): void {
    const next: Record<string, string | undefined> = { ...colours };
    if (value) next[key] = value; else delete next[key];
    setColours(next as LaneColours);
  }

  function setWalls(show: boolean, colour: string, alpha: number): void {
    const next = { ...colours };
    if (show) next.walls = withAlpha(colour, alpha || 0.2); else delete next.walls;
    setColours(next);
  }

  function setZone(length: number | undefined, height: number | undefined): void {
    doc.change(["zone"], () => {
      const z: { length?: number; height?: number } = {};
      if (length != null) z.length = length;
      if (height != null) z.height = height;
      if (Object.keys(z).length) c.zone = z; else delete c.zone;
    });
  }

  function setRules(spawn: string, cleanup: number | undefined): void {
    doc.change(["rules"], () => {
      const rules = { ...(c.rules ?? {}) };
      if (spawn === "all") delete rules.spawn; else rules.spawn = spawn as "discs" | "none";
      if (cleanup == null) delete rules.cleanup; else rules.cleanup = Math.max(0, cleanup);
      if (Object.keys(rules).length) c.rules = rules; else delete c.rules;
    });
  }

  function setArenaSpot(x: number | undefined, z: number | undefined, facing: number | undefined): void {
    doc.change(["arena"], () => {
      const a = { ...(c.arena ?? { map: "here" as const }) };
      if (x != null && z != null) a.at = { x, z }; else delete a.at;
      if (facing != null) a.facing = facing; else delete a.facing;
      c.arena = a;
    });
  }

  function setMusic(file: string, start: number, volume: number): void {
    doc.change(["music"], () => {
      if (!file.trim()) { delete c.music; return; }
      c.music = { file: file.trim(), start: start || 0, volume: Math.min(1, Math.max(0, Number.isNaN(volume) ? 1 : volume)) };
    });
  }

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

{#if phase}<PhaseEditor {phase} index={editor.selectedPhase} />{/if}

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
    <label><span>Start x</span><input type="number" step="0.1" value={arena.at?.x ?? ""} placeholder="laid across the middle" onchange={e => setArenaSpot(optionalNum(e), arena.at?.z, arena.facing)} /></label>
    <label><span>Start z</span><input type="number" step="0.1" value={arena.at?.z ?? ""} onchange={e => setArenaSpot(arena.at?.x, optionalNum(e), arena.facing)} /></label>
    <label><span>Facing °</span><input type="number" step="5" value={arena.facing ?? ""} placeholder="north" onchange={e => setArenaSpot(arena.at?.x, arena.at?.z, optionalNum(e))} /></label>
  </div>
  <div class="note">Easiest in game: Chart editing on, then SETUP on the picker - walk the lane and SAVE.</div>
{/if}

<h3>Your zone and rules</h3>
<div class="grid3">
  <label><span>Zone length m</span><input type="number" step="0.5" min="0.5" value={c.zone?.length ?? ""} placeholder={String(zoneOf(c).length)} onchange={e => setZone(optionalNum(e), c.zone?.height)} /></label>
  <label><span>Zone height m</span><input type="number" step="0.5" min="1" value={c.zone?.height ?? ""} placeholder="3.5" onchange={e => setZone(c.zone?.length, optionalNum(e))} /></label>
  <label><span>Clean up still structures after s</span><input type="number" step="0.5" min="0" value={c.rules?.cleanup ?? ""} placeholder="3 (0 = never)" onchange={e => setRules(c.rules?.spawn ?? "all", optionalNum(e))} /></label>
  <label><span>You may spawn</span>
    <select value={(c.rules?.spawn ?? "all").toLowerCase()} onchange={e => setRules(text(e), c.rules?.cleanup)}>
      <option value="all">everything</option><option value="discs">discs only</option><option value="none">nothing - moves only</option>
    </select>
  </label>
</div>
<div class="note">You cannot go past the zone's line or above its height. Structures and actors pass through both.</div>

<h3>Lane colours</h3>
<div class="grid2">
  {#each LANE_COLOURS as [key, label, mine] (key)}
    <label>
      <span>{label}{#if colours[key]} <a href="#default" onclick={e => { e.preventDefault(); setLaneColour(key, undefined); }}>default</a>{/if}</span>
      <input type="color" value={(colours[key] ?? mine).slice(0, 7)} onchange={e => setLaneColour(key, text(e))} />
    </label>
  {/each}
</div>
<div class="grid3">
  <label><span>Show walls</span><input type="checkbox" checked={!!walls} onchange={e => setWalls(checked(e), (walls ?? WALL_COLOUR).slice(0, 7), alphaOf(walls ?? WALL_DEFAULT))} /></label>
  <label><span>Wall colour</span><input type="color" disabled={!walls} value={(walls ?? WALL_COLOUR).slice(0, 7)} onchange={e => setWalls(true, text(e), alphaOf(walls))} /></label>
  <label><span>Wall opacity {Math.round(alphaOf(walls ?? WALL_DEFAULT) * 100)}%</span>
    <input type="range" min="0.05" max="0.8" step="0.05" disabled={!walls} value={alphaOf(walls ?? WALL_DEFAULT)} onchange={e => setWalls(true, (walls ?? WALL_COLOUR).slice(0, 7), num(e))} />
  </label>
</div>
<div class="note">Walls are invisible unless shown: then a see-through pane marks each one, as high as your zone.</div>

<h3>Song and cover</h3>
<div class="grid3">
  <label><span>Song file</span><input value={m?.file ?? ""} placeholder="song.mp3" onchange={e => setMusic(text(e), m?.start ?? 0, m?.volume ?? 1)} /></label>
  <label><span>Chart starts at song s</span><input type="number" step="0.01" value={m?.start ?? 0} onchange={e => setMusic(m?.file ?? "", num(e), m?.volume ?? 1)} /></label>
  <label><span>Volume</span><input type="number" step="0.05" min="0" max="1" value={m?.volume ?? 1} onchange={e => setMusic(m?.file ?? "", m?.start ?? 0, num(e))} /></label>
</div>
<div class="grid2">
  <label><span>Cover image</span><input value={c.cover ?? ""} placeholder="cover.png" onchange={e => set("cover", text(e).trim() || undefined)} /></label>
  {#if editor.cover}
    <img src={editor.cover} alt="Cover" />
  {:else}
    <div class="note">Open the song and cover files to hear and see them here. Songs: MP3, OGG or WAV.</div>
  {/if}
</div>

<style>
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
  .stat { display: grid; gap: 2px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; }
  .stat b { font: 600 20px var(--mono); font-variant-numeric: tabular-nums; }
  .stat span { font-size: 11px; color: var(--dust); text-transform: uppercase; letter-spacing: .05em; }
  img { max-height: 96px; max-width: 100%; border-radius: 6px; }
</style>
