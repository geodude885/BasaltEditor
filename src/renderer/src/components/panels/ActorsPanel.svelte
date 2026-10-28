<script lang="ts">
  import { actorsOf, laneOf, stoneName } from "../../model/chart";
  import { LOOKS, STONES } from "../../model/constants";
  import { addActor, renameActor } from "../../model/edits";
  import { trackOfActor, trackRows } from "../../model/tracks";
  import type { Actor } from "../../model/types";
  import { doc } from "../../store/document.svelte";
  import { num, text } from "../fields";

  const actors = $derived(actorsOf(doc.chart));

  /** Edits one actor - on a copy of the list, so the default actor the mod makes becomes a written one. */
  function edit(i: number, mutate: (a: Actor) => void): void {
    doc.change(["actors"], () => {
      const list = actorsOf(doc.chart).map(a => ({ ...a, at: a.at ? { ...a.at } : undefined }));
      mutate(list[i]);
      doc.chart.actors = list;
    });
  }

  function setSpot(i: number, axis: "x" | "z", value: number): void {
    edit(i, a => { a.at = { x: a.at?.x ?? 0, z: a.at?.z ?? laneOf(doc.chart).length, ...a.at, [axis]: value }; });
  }

  /** Slot 0 may be "you" - whoever plays's stones; otherwise up to two stone names. */
  function setStone(i: number, slot: 0 | 1, value: string): void {
    edit(i, a => {
      if (slot === 0 && value === "you") { delete a.shiftstones; return; }
      const now = Array.isArray(a.shiftstones) ? [...a.shiftstones] as string[] : [];
      now[slot] = value;
      a.shiftstones = now.filter(Boolean).map(s => s.endsWith("Stone") ? s : s + "Stone") as Actor["shiftstones"];
    });
  }

  const lookKept = (look: string) => !LOOKS.some(([v]) => v.toLowerCase() === look.toLowerCase());
  const stonesOf = (a: Actor): string[] | null => Array.isArray(a.shiftstones) ? a.shiftstones.map(stoneName) : null;
  const stoneValue = (stones: string[] | null, slot: number): string => {
    if (!stones) return slot === 0 ? "you" : "";
    return STONES.find(s => s.toLowerCase() === stones[slot]?.toLowerCase()) ?? "";
  };
</script>

<div class="note">
  Actors are the game-simulated players in the lane. The first is who events act on unless they name another. Spots are lane metres: x across, z from you.
</div>
<div class="list">
  {#each actors as a, i (i)}
    {@const look = a.look ?? "you"}
    {@const stones = stonesOf(a)}
    {@const recorded = trackOfActor(doc.chart, a.id ?? "") >= 0}
    <div class="item">
      <label><span>Id</span><input value={a.id ?? ""} onchange={e => { const id = text(e); doc.change(["actors"], () => renameActor(doc.chart, i, id)); }} /></label>
      <label><span>Name</span><input value={a.name ?? ""} onchange={e => edit(i, a => { a.name = text(e); })} /></label>
      <label><span>x</span><input type="number" step="0.1" value={a.at?.x ?? 0} onchange={e => setSpot(i, "x", num(e))} /></label>
      <label><span>z</span><input type="number" step="0.1" value={a.at?.z ?? laneOf(doc.chart).length} onchange={e => setSpot(i, "z", num(e))} /></label>
      <label><span>Look</span>
        <select value={lookKept(look) ? look : LOOKS.find(([v]) => v.toLowerCase() === look.toLowerCase())![0]} onchange={e => edit(i, a => { a.look = text(e); })}>
          {#if lookKept(look)}<option value={look}>as made in game</option>{/if}
          {#each LOOKS as [value, label] (value)}<option {value}>{label}</option>{/each}
        </select>
      </label>
      <label><span>Paste a look</span>
        <input placeholder="a look from another chart" onchange={e => { const v = text(e).trim(); if (v) edit(i, a => { a.look = v; }); }} />
      </label>
      <label><span>Shiftstones</span>
        <select value={stoneValue(stones, 0)} onchange={e => setStone(i, 0, text(e))}>
          <option value="you">whoever plays's</option>
          <option value="">none</option>
          {#each STONES as s (s)}<option>{s}</option>{/each}
        </select>
      </label>
      <label><span>&nbsp;</span>
        <select value={stoneValue(stones, 1)} disabled={!stones} onchange={e => setStone(i, 1, text(e))}>
          <option value="">none</option>
          {#each STONES as s (s)}<option>{s}</option>{/each}
        </select>
      </label>
      <button disabled={actors.length < 2 || recorded} title={recorded ? "This actor has recorded clips. Remove its track in game first." : null}
        onclick={() => doc.change(["actors"], () => { doc.chart.actors = actorsOf(doc.chart).filter((_, j) => j !== i); })}>Remove</button>
    </div>
  {/each}
</div>
<div class="note">
  A chart made in game dresses its boss as its maker, stones and all, so everyone fights the boss you made. "Whoever plays" dresses it as each
  player instead. Paste a look copies a look made in game from another chart.
</div>
<div class="row"><button onclick={() => doc.change(["actors"], () => addActor(doc.chart))}>Add an actor</button></div>
{#if doc.chart.tracks?.length}
  <div class="note">
    Recorded clips for {trackRows(doc.chart).map(row => row.label).join(", ")}, each in a row of its own on the timeline. Record or re-record them in game.
  </div>
{/if}
