<script lang="ts">
  // The chart's looks as a list under its phases: filtered by pack or by what they set, the one in effect at the
  // playhead marked and kept in view while playing. A press selects a look and seeks to it; Ctrl (or Cmd), or a tap with
  // Multi-select on, adds one to the selection or takes it out; Shift selects the run from the last one pressed.
  import { lookImpacts } from "../../model/lookImpact";
  import { lookInEffect, lookSections, packsIn, rowsBetween, type LookFilter } from "../../model/lookList";
  import { STAGE_PACK } from "../../model/looks";
  import { round } from "../../model/tempo";
  import { selectLook, selectLookCue } from "../../store/actions";
  import { doc } from "../../store/document.svelte";
  import { editing } from "../../store/editing.svelte";
  import { seek } from "../../store/playback";
  import { transport } from "../../store/transport.svelte";
  import { text } from "../fields";

  const STAGE_GROUPS = [...new Set(STAGE_PACK.parameters.map(p => p.group ?? "Other"))];
  let filter = $state<LookFilter>({ pack: null, group: null });
  let collapsed = $state(new Set<string>());
  let anchor = -1;
  let list: HTMLElement | undefined = $state();

  const packs = $derived(packsIn(doc.chart));
  const impacts = $derived(lookImpacts(doc.lookCues));
  const sections = $derived(lookSections(doc.chart, doc.tempo, filter, impacts));
  const shown = $derived(sections.reduce((n, s) => n + s.rows.length, 0));
  const now = $derived(lookInEffect(doc.chart, doc.tempo, transport.time));

  function press(event: MouseEvent, index: number, time: number): void {
    if (event.shiftKey && anchor >= 0) editing.setLookSelection(rowsBetween(sections, anchor, index));
    else if (event.ctrlKey || event.metaKey || editing.multiSelect) { selectLook(index, true); anchor = index; }
    else { selectLookCue(index); anchor = index; if (Number.isFinite(time)) seek(time); }
  }

  function toggle(key: string): void {
    const next = new Set(collapsed);
    if (!next.delete(key)) next.add(key);
    collapsed = next;
  }

  // While playing, the look in effect stays in view, as the timeline follows the playhead.
  $effect(() => {
    if (!transport.playing || now < 0 || !list) return;
    list.querySelector(`[data-look="${now}"]`)?.scrollIntoView({ block: "nearest" });
  });
</script>

<div class="filters row">
  {#if packs.length > 1}
    <select aria-label="Pack" value={filter.pack ?? ""} onchange={e => { filter = { ...filter, pack: text(e) || null }; }}>
      <option value="">Every pack</option>
      {#each packs as pack (pack)}<option value={pack}>{pack}</option>{/each}
    </select>
  {/if}
  <select aria-label="Sets" value={filter.group ?? ""} onchange={e => { filter = { ...filter, group: text(e) || null }; }}>
    <option value="">Setting anything</option>
    {#each STAGE_GROUPS as group (group)}<option value={group}>Setting {group}</option>{/each}
  </select>
  <label class="check" title="Only the looks that change little - easy to miss in the game, and candidates to delete or simplify">
    <input type="checkbox" checked={!!filter.smallOnly} onchange={e => { filter = { ...filter, smallOnly: (e.currentTarget as HTMLInputElement).checked }; }} /> Only small changes
  </label>
  <span class="note">{shown === (doc.chart.shaders?.length ?? 0) ? `${shown} looks` : `${shown} of ${doc.chart.shaders?.length ?? 0} looks`}</span>
  {#if filter.smallOnly && shown}<button onclick={() => editing.setLookSelection(sections.flatMap(s => s.rows.map(r => r.index)))}>Select them</button>{/if}
</div>

<div class="list" class:long={shown > 5} role="listbox" aria-label="Look cues" aria-multiselectable="true" bind:this={list}>
  {#each sections as section (section.key)}
    <button class="section" aria-expanded={!collapsed.has(section.key)} onclick={() => toggle(section.key)}>
      <span class="chevron">{collapsed.has(section.key) ? "▸" : "▾"}</span> {section.title} <small>{section.rows.length}</small>
    </button>
    {#if !collapsed.has(section.key)}
      {#each section.rows as row (row.index)}
        <button role="option" data-look={row.index} aria-selected={editing.selectedLooks.has(row.index)}
          class="look" class:stage={row.stage} class:now={row.index === now} onclick={e => press(e, row.index, row.time)}>
          <b>{row.label}</b>
          <span class="summary">
            {#if row.impact !== null}<span class="impact" title={`Changes the look by ${Math.round(row.impact * 100)}%`} style:--impact={row.impact}></span>{/if}
            {row.summary}
          </span>
          <span class="pack">{row.stage ? "" : row.pack}{row.fade ? `${row.stage ? "" : " · "}${round(row.fade, 2)} s fade` : ""}</span>
        </button>
      {/each}
    {/if}
  {:else}
    <div class="note">No looks {filter.pack || filter.group ? "match that" : "yet"}.</div>
  {/each}
</div>
<div class="note hint">Shift-click selects a run of looks, and Ctrl-click (or Multi-select) adds one, to edit or move them together.</div>

<style>
  .list { display: grid; gap: 1px; align-content: start; max-height: 280px; overflow-y: auto; touch-action: pan-y; border: 1px solid var(--line); border-radius: 8px; padding: 4px; background: var(--bg); }
  /* A scrolling box in the panel's grid can be squeezed to nothing in a short panel: a long list keeps some room. */
  .list.long { min-height: 160px; }
  .section { display: flex; gap: 6px; align-items: baseline; border: none; background: none; padding: 6px 4px 2px; font-size: 12px; font-weight: 600; text-align: left; position: sticky; top: -4px; background: var(--bg); z-index: 1; }
  .section small { color: var(--text-dim); font-weight: 400; }
  .chevron { color: var(--text-dim); width: 1em; }
  .look { display: grid; grid-template-columns: 6.5em minmax(0, 1fr) auto; gap: 8px; align-items: baseline; text-align: left; font-size: 12px; padding: 3px 8px; border-color: transparent; border-left: 3px solid transparent; }
  .look.stage { border-left-color: color-mix(in srgb, var(--look) 50%, transparent); }
  .look b { font: 12px var(--mono); }
  .summary { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pack { color: var(--text-dim); font-size: 11px; white-space: nowrap; }
  /* How much the look changes: a bar from nothing to its full width. */
  .impact { display: inline-block; width: 28px; height: 6px; margin-right: 6px; border-radius: 3px; vertical-align: middle;
    background: linear-gradient(90deg, var(--look) calc(var(--impact) * 100%), color-mix(in srgb, var(--wash) 10%, transparent) 0); }
  .look.now { background: color-mix(in srgb, var(--wash) 7%, transparent); }
  .look.now b::before { content: "▶ "; color: var(--look); }
  .look[aria-selected="true"] { border-color: var(--look); background: color-mix(in srgb, var(--look) 13%, transparent); }
  .hint { font-size: 11px; }
</style>
