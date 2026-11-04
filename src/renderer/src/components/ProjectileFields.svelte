<script lang="ts">
  // A projectile's fields from model/projectileFields.ts, for one projectile or several: what they share, "mixed"
  // where they differ, and a word in place of a field that doesn't apply to them. Each change is one undo step.
  import { MIXED, shared } from "../model/batch";
  import { fieldRows, fieldsFor, type ProjectileField } from "../model/projectileFields";
  import { round } from "../model/tempo";
  import type { ChartEvent, Projectile } from "../model/types";
  import { doc } from "../store/document.svelte";
  import { checked, num, text } from "./fields";

  let { events, edit }: { events: ChartEvent[]; edit: (mutate: (e: ChartEvent) => void) => void } = $props();

  const shots = $derived(events.map(e => e.projectile).filter((p): p is Projectile => !!p));
  const one = $derived(shots.length === 1);
  const rows = $derived(fieldRows(fieldsFor(events)));

  const fixedOf = (f: ProjectileField) => shared(shots, p => f.fixed?.(p) ?? null);
  /** A tick that shows a dash when some of them have it and some don't. */
  const someOf = (node: HTMLInputElement, some: boolean) => { node.indeterminate = some; return { update: (now: boolean) => { node.indeterminate = now; } }; };
  /** Sets a number on every one, leaving them alone when the field is left blank (as a "mixed" one is). */
  function setNumber(f: ProjectileField & { kind: "number" }, event: Event): void {
    const n = num(event);
    if (Number.isFinite(n)) edit(e => f.write(e.projectile!, n));
  }
</script>

{#each rows as row, r (r)}
  <div class={row.length >= 3 ? "grid3" : row.length === 2 ? "grid2" : "single"}>
    {#each row as f (f.id)}
      {#if f.kind === "number"}
        {@const fixed = fixedOf(f)}
        {@const value = shared(shots, f.read)}
        <label title={f.help}><span>{f.label}{one && f.slider && !fixed ? ` ${round(f.read(shots[0]), 2)}` : ""}</span>
          {#if typeof fixed === "string"}
            <input disabled value={fixed} />
          {:else}
            <input type="number" step={f.step} min={f.min} placeholder="mixed" value={value === MIXED ? "" : round(value, 3)} onchange={e => setNumber(f, e)} />
            {#if one && f.slider}
              <input type="range" min={f.slider.min} max={f.slider.max} step={f.step / 2} value={f.read(shots[0])} onchange={e => setNumber(f, e)} />
            {/if}
          {/if}
        </label>
      {:else if f.kind === "choice"}
        {@const value = shared(events, e => f.read(e, doc.chart))}
        <label title={f.help}><span>{f.label}</span>
          <select value={value === MIXED ? "" : value} onchange={e => { const v = text(e); if (v) edit(ev => f.write(ev, v, doc.chart)); }}>
            {#if value === MIXED}<option value="" disabled>mixed</option>{/if}
            {#each f.choices(doc.chart) as choice (choice.value)}<option value={choice.value}>{choice.label}</option>{/each}
          </select>
        </label>
      {:else}
        {@const value = shared(shots, f.read)}
        <label class="check" title={f.help}>
          <input type="checkbox" checked={value === true} use:someOf={value === MIXED} onchange={e => { const on = checked(e); edit(ev => f.write(ev.projectile!, on)); }} />
          {f.label}{one && f.note ? f.note(shots[0]) : value === MIXED ? " (some are)" : ""}
        </label>
      {/if}
    {/each}
  </div>
{/each}

<style>
  .single { display: grid; }
</style>
