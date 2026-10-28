<script lang="ts">
  // The chart's song: which it is, whether it's open (so it plays and shows its waveform), and buttons
  // to choose another, switch between songs already open, or take it out.
  import { findSong, isSong } from "../io/files";
  import { clockText } from "../model/tempo";
  import { doc } from "../store/document.svelte";
  import { session } from "../store/session.svelte";
  import { chooseSong, removeSong, useSong } from "../store/files";

  const named = $derived(doc.chart.music?.file ?? "");
  const songs = $derived([...session.files.keys()].filter(isSong));
  const playing = $derived(session.song?.name ?? "");
  const status = $derived.by(() => {
    if (!named) return "No song yet.";
    if (!playing) return "Not open here. Choose the file to hear it.";
    if (findSong(session.files, named) !== playing) return `Playing ${playing} until ${named} is open.`;
    const seconds = session.song?.buffer?.duration;
    return seconds ? `Open · ${clockText(seconds, 0)}` : "Open · reading…";
  });
</script>

<div class="song">
  <div class="now">
    <span class="label">Song</span>
    <b title={named}>{named || "None"}</b>
    <small class:warn={!!named && findSong(session.files, named) !== playing}>{status}</small>
  </div>
  <div class="row">
    <button class="primary" onclick={chooseSong}>{named ? "Change song…" : "Choose song…"}</button>
    {#if songs.length > 1}
      <select aria-label="Use another open song" value={playing} onchange={e => useSong(e.currentTarget.value)}>
        {#each songs as name (name)}<option value={name}>{name}</option>{/each}
      </select>
    {/if}
    {#if named}<button onclick={removeSong}>Remove</button>{/if}
  </div>
</div>

<style>
  .song { display: grid; gap: 6px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); }
  .now { display: grid; gap: 2px; min-width: 0; }
  .label { font-size: 11px; color: var(--text-dim); text-transform: uppercase; letter-spacing: .04em; }
  b { font: 600 16px/1.2 var(--display); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  small { color: var(--text-dim); font-size: 12px; }
  small.warn { color: var(--telegraph); }
  select { min-width: 0; max-width: 100%; }
</style>
