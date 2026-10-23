<script lang="ts">
  // Your charts, as cards: cover, name, who made it, how many projectiles, the song, when it last
  // changed. Tap one to open it; each can be duplicated or deleted (on the desktop, moved to the bin).
  // New and Import start or bring in another. Works in both layouts, over everything else.
  import Icon from "../Icon.svelte";
  import { startNewChart } from "../../store/commands";
  import { openFiles } from "../../store/files";
  import { library, type ChartSummary } from "../../store/library.svelte";

  let confirming = $state<string | null>(null);
  let closeButton: HTMLButtonElement;

  // A dialog over everything: it takes the focus, and Escape closes it.
  $effect(() => { closeButton.focus(); });
  const keydown = (ev: KeyboardEvent) => { if (ev.key === "Escape") library.visible = false; };

  // Covers as images, made once per list and let go when it changes.
  const covers = $derived(new Map(library.entries.filter(e => e.cover).map(e => [e.id, URL.createObjectURL(new Blob([e.cover as BlobPart]))])));
  $effect(() => {
    const made = covers;
    return () => { for (const url of made.values()) URL.revokeObjectURL(url); };
  });

  function when(ms: number): string {
    const minutes = Math.round((Date.now() - ms) / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h ago`;
    return new Date(ms).toLocaleDateString();
  }

  const detail = (e: ChartSummary) => [e.author, e.difficulty, `${e.projectiles} projectile${e.projectiles === 1 ? "" : "s"}`].filter(Boolean).join(" · ");

</script>

<svelte:window onkeydown={keydown} />

<div class="library" role="dialog" aria-modal="true" aria-label="Your charts">
  <header>
    <h2>Your charts</h2>
    <div class="spacer"></div>
    <button onclick={startNewChart}>New</button>
    <button title="Open a .bbchart package or chart files" onclick={() => { library.visible = false; void openFiles(); }}>Import…</button>
    <button class="close" aria-label="Close" bind:this={closeButton} onclick={() => { library.visible = false; }}><Icon name="close" /></button>
  </header>
  <p class="note">
    {#if library.autosaves}
      Kept in this browser, with their songs and covers, and saved as you go. Browsers can clear what
      sites keep, so use Package to save a copy of anything you'd miss.
    {:else}
      The chart folders in the game's Charts folder - New starts one here, and a chart you open from
      elsewhere joins when you Save it. Open one to edit it in place, and Save (Ctrl S) to
      write it back - the game reloads it within a second.
    {/if}
  </p>
  {#if !library.entries.length}
    <div class="empty">
      <p>{library.autosaves ? "Charts you open or start show up here." : "No chart folders in the game's Charts folder yet."}</p>
      <button class="primary" onclick={startNewChart}>Start a chart</button>
    </div>
  {:else}
    <ul class="cards">
      {#each library.entries as e (e.id)}
        <li class="card" class:current={library.isCurrent(e.id)}>
          <button class="open" onclick={() => library.open(e.id)} aria-label="Open {e.name}">
            {#if covers.get(e.id)}<img src={covers.get(e.id)} alt="" />{:else}<div class="nocover" aria-hidden="true">{e.name.slice(0, 1)}</div>{/if}
            <span class="text">
              <b>{e.name}</b>
              <small>{detail(e)}</small>
              <small>{e.song ?? "No song"} · {when(e.updated)}</small>
            </span>
          </button>
          <div class="actions">
            {#if library.isCurrent(e.id)}<span class="badge">Open now</span>{/if}
            <button onclick={() => library.duplicate(e.id)}>Duplicate</button>
            {#if confirming === e.id}
              <button class="danger" onclick={() => { confirming = null; void library.remove(e.id); }}>{library.autosaves ? "Delete it" : "Move to the bin"}</button>
              <button onclick={() => { confirming = null; }}>Keep</button>
            {:else}
              <button onclick={() => { confirming = e.id; }}>Delete…</button>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .library {
    position: fixed; inset: 0; z-index: 20; display: flex; flex-direction: column; gap: 8px; background: var(--bg); overflow: auto;
    overscroll-behavior: contain; padding: max(12px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
  }
  header { display: flex; align-items: center; gap: 8px; }
  h2 { margin: 0; font: 700 22px/1 var(--display); text-transform: uppercase; letter-spacing: .06em; }
  .spacer { flex: 1; }
  button { min-height: 38px; }
  .close { min-width: 40px; }
  .note { margin: 0; color: var(--text-dim); font-size: 13px; max-width: 80ch; }
  .empty { display: grid; gap: 8px; justify-items: start; padding: 24px 0; color: var(--text-dim); }
  .cards { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
  .card { display: grid; gap: 6px; padding: 8px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel); min-width: 0; }
  .card.current { border-color: var(--accent); }
  .open {
    display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 10px; align-items: center; text-align: left;
    padding: 0; border: 0; background: none; white-space: normal;
  }
  img, .nocover { width: 64px; height: 64px; border-radius: 8px; object-fit: cover; }
  .nocover { display: grid; place-items: center; background: var(--raised); color: var(--text-dim); font: 700 28px var(--display); text-transform: uppercase; }
  .text { display: grid; gap: 2px; min-width: 0; }
  b { font: 600 17px/1.15 var(--display); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  small { color: var(--text-dim); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .actions { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; justify-content: flex-end; }
  .actions button { min-height: 34px; font-size: 13px; }
  .badge { margin-right: auto; font-size: 12px; color: var(--accent); }
  .danger { color: var(--bad); border-color: var(--bad); }
</style>
