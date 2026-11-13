<script lang="ts">
  // What the game refuses (problems), what it reads oddly (warnings), and close calls: structures that may touch
  // before they're on their way. Close calls aren't problems - the game plays them, and they may be meant.
  import { closeCallText, type CloseCall } from "../../model/closeCalls";
  import { clockText } from "../../model/tempo";
  import { closeCallState } from "../../store/closeCalls.svelte";
  import { doc } from "../../store/document.svelte";
  import { editing } from "../../store/editing.svelte";
  import { seek } from "../../store/playback";
  import { session } from "../../store/session.svelte";
  import { checked } from "../fields";

  const calls = $derived(closeCallState.visible);

  /** Selects the two projectiles and goes to just before they'd touch. */
  function show(call: CloseCall): void {
    editing.clearSelection();
    editing.setSelection([call.a, call.b]);
    seek(Math.max(0, call.at - 0.5));
  }

  function selectAll(): void {
    editing.clearSelection();
    editing.setSelection(new Set(calls.flatMap(call => [call.a, call.b])));
  }
</script>

<div class="problems">
  {#each session.problems as problem, i (i)}
    <div>{problem}</div>
  {:else}
    <div class="none">No problems found.</div>
  {/each}
  {#each session.warnings as warning, i (i)}
    <div class="warning">{warning}</div>
  {/each}
</div>

<section class="close">
  <div class="head">
    <h3>Close calls{calls.length ? ` (${calls.length})` : ""}</h3>
    <span class="spacer"></span>
    {#if calls.length > 1}<button onclick={selectAll}>Select them all</button>{/if}
    <label class="toggle"><input type="checkbox" checked={closeCallState.shown} onchange={e => closeCallState.show(checked(e))} /> Look for them</label>
  </div>
  {#if closeCallState.shown}
    <div class="note">
      Structures that may touch before they're on their way - waiting side by side, or one launched and not yet clear of the next -
      which can hitstun, slow or break them. A guess from their sizes and straight flights; the game plays them either way.
      <b>Meant</b> hides one until either projectile changes.
      {#if closeCallState.meantHere}<button class="link" onclick={() => closeCallState.unmarkHere()}>Show the {closeCallState.meantHere} meant here again</button>{/if}
    </div>
    <div class="list">
      {#each calls as call (`${call.a}:${call.b}`)}
        <div class="call">
          <button class="go" title="Select both, and go to just before they'd touch" onclick={() => show(call)}>
            <span class="time">{clockText(call.at, 2)}</span> {closeCallText(doc.chart, call)}
          </button>
          <button title="This one is meant: stop showing it while both projectiles stay as they are" onclick={() => closeCallState.markMeant([call])}>Meant</button>
        </div>
      {:else}
        <div class="none">None found.</div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .problems { display: grid; gap: 4px; font: 13px var(--mono); }
  .problems div { padding: 4px 8px; border-left: 3px solid var(--bad); background: color-mix(in srgb, var(--bad) 8%, transparent); }
  .problems .warning { border-left-color: var(--telegraph); background: color-mix(in srgb, var(--telegraph) 8%, transparent); }
  .problems .none, .close .none { border-left: 3px solid var(--good); background: color-mix(in srgb, var(--good) 8%, transparent); padding: 4px 8px; font: 13px var(--mono); }
  .close { display: grid; gap: 6px; margin-top: 14px; }
  .head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .head h3 { margin: 0; }
  .spacer { flex: 1; }
  .toggle { display: flex; align-items: center; gap: 4px; font-size: 12px; }
  .list { display: grid; gap: 3px; max-height: 320px; overflow-y: auto; }
  .call { display: flex; gap: 4px; align-items: stretch; }
  .call .go {
    flex: 1; text-align: left; font: 12px var(--mono); padding: 3px 8px;
    border-left: 3px solid var(--telegraph); background: color-mix(in srgb, var(--telegraph) 7%, transparent);
  }
  .time { color: var(--text-dim); margin-right: 6px; }
  .link { background: none; border: none; padding: 0; color: var(--accent); text-decoration: underline; cursor: pointer; font: inherit; }
</style>
