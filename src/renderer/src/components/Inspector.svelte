<script lang="ts">
  // The selected event's fields. Every change goes through editSelected, which keeps it selected
  // wherever the edit sorts it to.
  import { actorsOf, evTime, firstActorId, isGrounded, kindOf, onFloor } from "../model/chart";
  import { GROUNDED_STATE, MOVES, STRUCTURES } from "../model/constants";
  import { round } from "../model/tempo";
  import type { ChartEvent, Projectile, Structure } from "../model/types";
  import { copySelected, editSelected, mirrorSelected, removeSelected, throwFromActor } from "../store/actions";
  import { doc } from "../store/document.svelte";
  import { editing } from "../store/editing.svelte";
  import BatchInspector from "./BatchInspector.svelte";
  import { checked, num, text } from "./fields";

  const selected = $derived([...editing.selection].filter(i => doc.chart.events[i]));
  const index = $derived(selected.length === 1 ? selected[0] : -1);
  const e = $derived<ChartEvent | undefined>(doc.chart.events[index]);
  const kind = $derived(e ? kindOf(e) : "?");
  const actors = $derived(actorsOf(doc.chart));
  const first = $derived(firstActorId(doc.chart));

  const edit = (mutate: (e: ChartEvent) => void) => editSelected(mutate);
  const shot = (mutate: (s: Projectile) => void) => editSelected(ev => mutate(ev.projectile!));

  /** A projectile's timings, as a sentence. */
  function timings(ev: ChartEvent, s: Projectile): string {
    const tp = doc.tempo, t = evTime(ev, tp), tel = s.telegraph ?? 0.5;
    const aimX = s.to && s.to !== "player" ? s.to.x : 0;
    const air = Math.hypot(s.from?.z || 0, (s.from?.x || 0) - aimX) / Math.max(0.1, s.speed || 1);
    return `Appears ${round(t - tel, 2)} s, flies ${round(t, 2)} s${tp.ok ? ` (beat ${round(tp.beat(t), 2)})` : ""}, ${round(air, 2)} s in the air.`;
  }
</script>

<div class="inspector">
  {#if selected.length === 0}
    <div class="note">
      Click a projectile here or on the timeline. Double-click the lane (or press <b>P</b>) to add one at the playhead; drag its dot to move where it starts.
    </div>
  {:else if selected.length > 1}
    <div class="kind">{selected.length} selected</div>
    <BatchInspector />
    <div class="row">
      <button onclick={mirrorSelected}>Mirror left/right</button><button onclick={copySelected}>Copy</button><button onclick={removeSelected}>Delete</button>
    </div>
    <div class="note">Drag them on the timeline to move them together. Paste (Ctrl+V) puts a copy at the playhead.</div>
  {:else if e}
    <div class="row"><div class="kind">{kind === "at" ? "Actor moves" : kind}</div><span class="note">events[{index}]</span></div>

    {#snippet timeField(ev: ChartEvent)}
      {#if ev.beat != null}
        <label><span>Beat</span><input type="number" step="0.25" value={ev.beat} onchange={x => edit(ev => { ev.beat = round(Math.max(0, num(x)), 4); })} /></label>
      {:else}
        <label><span>Time (s)</span><input type="number" step="0.05" value={ev.t} onchange={x => edit(ev => { ev.t = round(Math.max(0, num(x)), 3); })} /></label>
      {/if}
    {/snippet}

    {#snippet actorField(ev: ChartEvent)}
      <label><span>Actor</span>
        <select value={ev.actor ?? first} onchange={x => edit(ev => { const v = text(x); if (v === first) delete ev.actor; else ev.actor = v; })}>
          {#each actors as a (a.id)}<option value={a.id}>{a.name || a.id}</option>{/each}
        </select>
      </label>
    {/snippet}

    {#if kind === "projectile" && e.projectile}
      {@const s = e.projectile}
      {@const aimPoint = s.to && s.to !== "player" ? s.to : null}
      <div class="grid2">
        {@render timeField(e)}
        <label><span>Structure</span>
          <select value={s.structure} onchange={x => shot(s => { s.structure = text(x) as Structure; })}>
            {#each STRUCTURES as n (n)}<option>{n}</option>{/each}
          </select>
        </label>
      </div>
      <div class="grid3">
        <label><span>From x</span><input type="number" step="0.1" value={s.from?.x ?? 0} onchange={x => shot(s => { s.from.x = num(x); })} /></label>
        {#if onFloor(s)}
          <label><span>Height</span>
            <input disabled value={isGrounded(s) ? "grounded" : "on the floor"}
              title={isGrounded(s) ? "Grounded: it rests on the floor and is thrown along it" : `${s.structure} comes up out of the ground and rests on it`} />
          </label>
        {:else}
          <label><span>Height y</span><input type="number" step="0.1" min="0" value={s.from?.y ?? 0} onchange={x => shot(s => { s.from.y = round(Math.max(0, num(x)), 2); })} /></label>
        {/if}
        <label><span>From z</span><input type="number" step="0.1" value={s.from?.z ?? 10} onchange={x => shot(s => { s.from.z = num(x); })} /></label>
      </div>
      {#if !onFloor(s)}
        <label><span>Height {round(+(s.from?.y ?? 0), 2)} m</span>
          <input type="range" min="0" max="3" step="0.05" value={s.from?.y ?? 0} onchange={x => shot(s => { s.from.y = round(Math.max(0, num(x)), 2); })} />
        </label>
      {/if}
      <label class="check" title="Thrown along the floor, for more damage">
        <input type="checkbox" checked={isGrounded(s)}
          onchange={x => shot(s => { const on = checked(x); if (on === GROUNDED_STATE.includes(s.structure)) delete s.grounded; else s.grounded = on; })} />
        Grounded{GROUNDED_STATE.includes(s.structure) ? ` (default for a ${s.structure})` : ""}
      </label>
      <div class="grid3">
        <label><span>Aim</span>
          <select value={aimPoint ? "point" : "player"} onchange={x => shot(s => { s.to = text(x) === "player" ? "player" : { x: 0, y: 1.3 }; })}>
            <option value="player">at the player</option><option value="point">at a point</option>
          </select>
        </label>
        {#if aimPoint}
          <label><span>Aim x</span><input type="number" step="0.1" value={aimPoint.x} onchange={x => shot(s => { if (s.to && s.to !== "player") s.to.x = num(x); })} /></label>
          {#if isGrounded(s)}<span></span>{:else}
            <label><span>Aim y</span><input type="number" step="0.1" value={aimPoint.y} onchange={x => shot(s => { if (s.to && s.to !== "player") s.to.y = num(x); })} /></label>
          {/if}
        {:else}<span></span><span></span>{/if}
      </div>
      <div class="grid3">
        <label><span>Speed m/s</span><input type="number" step="0.5" min="0.5" value={s.speed} onchange={x => shot(s => { s.speed = Math.max(0.5, num(x) || 0); })} /></label>
        <label><span>Spawned s before</span><input type="number" step="0.1" min="0" value={s.telegraph ?? 0.5} onchange={x => shot(s => { s.telegraph = Math.max(0, num(x) || 0); })} /></label>
        <label><span>Thrown by</span>
          <select value={s.by ?? ""} onchange={x => shot(s => { const v = text(x); if (v) s.by = v; else delete s.by; })}>
            <option value="">nobody</option>
            {#each actors as a (a.id)}<option value={a.id}>{a.name || a.id}</option>{/each}
          </select>
        </label>
      </div>
      <div class="note">{timings(e, s)}</div>
    {:else if kind === "move"}
      <div class="grid2">
        {@render timeField(e)}
        <label><span>Move</span>
          <select value={e.move} onchange={x => edit(ev => { ev.move = text(x); })}>
            {#each MOVES as n (n)}<option>{n}</option>{/each}
          </select>
        </label>
      </div>
      {@render actorField(e)}
    {:else if kind === "at" && e.at}
      <div class="grid3">
        {@render timeField(e)}
        <label><span>To x</span><input type="number" step="0.1" value={e.at.x} onchange={x => edit(ev => { ev.at!.x = num(x); })} /></label>
        <label><span>To z</span><input type="number" step="0.1" value={e.at.z} onchange={x => edit(ev => { ev.at!.z = num(x); })} /></label>
      </div>
      {@render actorField(e)}
    {/if}

    <div class="row">
      <button onclick={mirrorSelected}>Mirror</button><button onclick={copySelected}>Copy</button><button onclick={removeSelected}>Delete</button>
      {#if kind === "projectile"}<button onclick={throwFromActor}>Throw from the actor</button>{/if}
    </div>
  {/if}
</div>

<style>
  .inspector { padding: 10px 12px 14px; display: grid; gap: 10px; border-top: 1px solid var(--line); }
  .kind { font: 700 18px/1 var(--display); text-transform: uppercase; letter-spacing: .04em; }
</style>
