<script lang="ts">
  // Several projectiles selected: the fields it makes sense to set for all of them at once. A field
  // they disagree on shows "mixed" until it's set. Times and positions across the lane stay each one's
  // own (model/batch.ts says why). Each change is one undo step for the lot.
  import { actorsOf, isGrounded } from "../model/chart";
  import { aimOf, MIXED, setAim, shared } from "../model/batch";
  import { GROUNDED_STATE, STRUCTURES } from "../model/constants";
  import { round } from "../model/tempo";
  import type { Projectile, Structure } from "../model/types";
  import { editSelectedProjectiles } from "../store/actions";
  import { doc } from "../store/document.svelte";
  import { editor } from "../store/editor.svelte";
  import { checked, num, text } from "./fields";

  const shots = $derived([...editor.selection].map(i => doc.chart.events[i]?.projectile).filter((p): p is Projectile => !!p));
  const others = $derived(editor.selection.size - shots.length);
  const actors = $derived(actorsOf(doc.chart));

  const structure = $derived(shared(shots, p => p.structure));
  const speed = $derived(shared(shots, p => +p.speed));
  const telegraph = $derived(shared(shots, p => +(p.telegraph ?? 0.5)));
  const by = $derived(shared(shots, p => p.by ?? ""));
  const height = $derived(shared(shots, p => +(p.from?.y ?? 0)));
  const distance = $derived(shared(shots, p => +(p.from?.z ?? 10)));
  const grounded = $derived(shared(shots, p => isGrounded(p)));
  const aim = $derived(shared(shots, aimOf));

  /** The "mixed" choice in the Thrown by list: no actor is called this. */
  const MIXED_BY = "(mixed)";
  const set = (mutate: (p: Projectile) => void) => editSelectedProjectiles(mutate);
  /** A number field's value, or blank (showing "mixed") where they differ. */
  const shown = (v: number | typeof MIXED) => v === MIXED ? "" : v;
  /** Leaves a field alone when it's left blank, so tapping in and out of a "mixed" one changes nothing. */
  const setNumber = (e: Event, apply: (p: Projectile, n: number) => void) => {
    const n = num(e);
    if (Number.isFinite(n)) set(p => apply(p, n));
  };
</script>

{#if shots.length}
  <div class="batch">
    <div class="note">
      Set any of these for all {shots.length} projectile{shots.length === 1 ? "" : "s"}{others ? ` (the ${others} other event${others === 1 ? "" : "s"} selected stay as they are)` : ""}.
      Their times and places across the lane stay their own.
    </div>
    <div class="grid2">
      <label><span>Structure</span>
        <select value={structure === MIXED ? "" : structure} onchange={e => { const v = text(e); if (v) set(p => { p.structure = v as Structure; }); }}>
          {#if structure === MIXED}<option value="" disabled>mixed</option>{/if}
          {#each STRUCTURES as n (n)}<option>{n}</option>{/each}
        </select>
      </label>
      <label><span>Aim</span>
        <select value={aim === MIXED || aim === "point" ? "" : aim} onchange={e => { const v = text(e); if (v === "player" || v === "straight") set(p => setAim(p, v)); }}>
          {#if aim === MIXED || aim === "point"}<option value="" disabled>{aim === MIXED ? "mixed" : "at points"}</option>{/if}
          <option value="straight">straight down the lane</option>
          <option value="player">at the player</option>
        </select>
      </label>
    </div>
    <div class="grid3">
      <label><span>Speed m/s</span>
        <input type="number" step="0.5" min="0.5" placeholder="mixed" value={shown(speed)} onchange={e => setNumber(e, (p, n) => { p.speed = Math.max(0.5, n); })} />
      </label>
      <label><span>Spawned s before</span>
        <input type="number" step="0.1" min="0" placeholder="mixed" value={shown(telegraph)} onchange={e => setNumber(e, (p, n) => { p.telegraph = Math.max(0, n); })} />
      </label>
      <label><span>Thrown by</span>
        <select value={by === MIXED ? MIXED_BY : by} onchange={e => { const v = text(e); if (v === MIXED_BY) return; set(p => { if (v) p.by = v; else delete p.by; }); }}>
          {#if by === MIXED}<option value={MIXED_BY} disabled>mixed</option>{/if}
          <option value="">nobody</option>
          {#each actors as a (a.id)}<option value={a.id}>{a.name || a.id}</option>{/each}
        </select>
      </label>
    </div>
    <div class="grid2">
      <label><span>Height y</span>
        <input type="number" step="0.1" min="0" placeholder="mixed" value={height === MIXED ? "" : round(height, 2)}
          onchange={e => setNumber(e, (p, n) => { p.from.y = round(Math.max(0, n), 2); })} />
      </label>
      <label><span>Distance z</span>
        <input type="number" step="0.5" min="0.5" placeholder="mixed" value={shown(distance)} onchange={e => setNumber(e, (p, n) => { p.from.z = round(Math.max(0.5, n), 2); })} />
      </label>
    </div>
    <label class="check" title="Thrown along the floor">
      <input type="checkbox" checked={grounded === true} indeterminate={grounded === MIXED}
        onchange={e => { const on = checked(e); set(p => { if (on === GROUNDED_STATE.includes(p.structure)) delete p.grounded; else p.grounded = on; }); }} />
      Grounded{grounded === MIXED ? " (some are)" : ""}
    </label>
  </div>
{/if}

<style>
  .batch { display: grid; gap: 10px; }
</style>
