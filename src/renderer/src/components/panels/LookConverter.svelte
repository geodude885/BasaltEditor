<script lang="ts">
  // Making looks with a converter: whatever it says it reads, its options as it describes them, what it will and
  // won't set, and the looks it makes - drawn from the converter's own description, so a new one needs nothing here.
  import { clockText, round } from "../../model/tempo";
  import { converting } from "../../store/converting.svelte";
  import { session } from "../../store/session.svelte";
  import { coverageByGroup, LOOK_CONVERTERS } from "../../video/converters";
  import { checked, num, text } from "../fields";

  const converter = $derived(converting.converter);
  const coverage = $derived(coverageByGroup(converter));
  const cues = $derived(converting.cues);
  const state = $derived(converting.state);
  const span = $derived(converting.span);
  const chosen = (id: string): readonly string[] => (converting.options[id] as readonly string[] | undefined) ?? [];
  const toggled = (id: string, choice: string, on: boolean) =>
    converting.setOption(id, on ? [...chosen(id), choice] : chosen(id).filter(c => c !== choice));
</script>

<section class="converter" aria-label="Make looks">
  <div class="row">
    <h3>Looks from a video</h3>
    {#if LOOK_CONVERTERS.length > 1}
      <select value={converting.converterId} onchange={e => converting.setConverter(text(e))}>
        {#each LOOK_CONVERTERS as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
      </select>
    {/if}
    <span class="spacer"></span>
    <button onclick={() => converting.close()}>Close</button>
  </div>
  <div class="note">{converter.description}</div>

  <div class="row">
    <button class="primary" disabled={state.kind === "reading"} onclick={() => converting.chooseVideo()}>
      {converting.videoName ? "Choose another video" : "Choose a video"}
    </button>
    {#if converting.videoName}<span class="name">{converting.videoName}</span>{/if}
  </div>
  {#if state.kind === "reading"}
    <div class="row">
      <progress max="1" value={state.done}></progress>
      <span class="note">{state.what} · {Math.round(state.done * 100)}%</span>
      <button onclick={() => converting.cancel()}>Cancel</button>
    </div>
  {:else if state.kind === "failed"}
    <div class="warning">Couldn't read that video: {state.why}</div>
  {/if}
  {#if converter.usesSong}
    <div class="note">
      {session.song?.buffer ? `Listens to the chart's song, ${session.song.name}, for its drums and loudness.` : "The chart has no song, so it goes by the video alone. Add one in the Chart tab first to have it follow the music."}
    </div>
  {/if}

  <div class="options">
    <label title="Where the video starts in the chart. A music video's sound is the song, so by default it starts where the song does">
      <span>Video starts at (s)</span>
      <input type="number" step="0.01" value={converting.videoStart} onchange={e => { converting.videoStart = num(e) || 0; }} />
    </label>
    {#each converter.options as option (option.id)}
      {#if option.kind === "number"}
        {@const value = +(converting.options[option.id] ?? option.default)}
        <label title={option.help}>
          <span>{option.label} {round(value, 2)}</span>
          <input type="range" min={option.min} max={option.max} step={option.step} {value} onchange={e => converting.setOption(option.id, num(e))} />
        </label>
      {:else}
        <fieldset title={option.help}>
          <legend>{option.label}</legend>
          {#each option.choices as choice (choice)}
            <label class="check"><input type="checkbox" checked={chosen(option.id).includes(choice)} onchange={e => toggled(option.id, choice, checked(e))} /> {choice}</label>
          {/each}
        </fieldset>
      {/if}
    {/each}
  </div>

  <details>
    <summary>What it sets, and what it leaves</summary>
    <div class="coverage">
      {#each coverage as group (group.group)}
        <div>
          <h4>{group.group}</h4>
          {#each group.made as entry (entry.name)}<div class="made" title={entry.how}><span class="mark">✓</span> {entry.name}<small>{entry.how}</small></div>{/each}
          {#each group.left as entry (entry.name)}<div class="left" title={entry.how}><span class="mark">–</span> {entry.name}<small>{entry.how}</small></div>{/each}
        </div>
      {/each}
    </div>
  </details>

  {#if state.kind === "ready"}
    <div class="result">
      <div class="note">
        {cues.length} looks from {clockText(span[0], 1)} to {clockText(span[1], 1)}. They're ordinary looks once added: change, move or delete
        any of them, or undo to take them all back.
      </div>
      <div class="row">
        <label class="check" title="Take out the BossBattles Stage looks already in that stretch, so the new ones aren't mixed with them">
          <input type="checkbox" checked={converting.replace} onchange={e => { converting.replace = checked(e); }} /> Replace the looks there
        </label>
        <button class="primary" disabled={!cues.length} onclick={() => converting.add()}>Add {cues.length} looks</button>
      </div>
    </div>
  {/if}
</section>

<style>
  .converter { display: grid; gap: 8px; padding: 10px; border: 1px solid var(--look); border-radius: 8px; background: color-mix(in srgb, var(--look) 6%, transparent); }
  h3 { margin: 0; }
  .spacer { flex: 1; }
  .name { font: 12px var(--mono); color: var(--text-dim); overflow-wrap: anywhere; }
  progress { flex: 1; min-width: 120px; accent-color: var(--look); }
  .options { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; align-items: start; }
  fieldset { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 0 12px; border: 1px solid var(--line); border-radius: 6px; padding: 4px 8px; margin: 0; }
  legend { font-size: 11px; letter-spacing: .04em; text-transform: uppercase; color: var(--text-dim); }
  fieldset label.check { margin: 2px 0; }
  summary { cursor: pointer; font-size: 13px; }
  .coverage { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 8px 14px; margin-top: 6px; }
  h4 { margin: 4px 0 2px; font-size: 12px; }
  .made, .left { display: grid; grid-template-columns: 1.2em 1fr; font-size: 12px; }
  .made small, .left small { grid-column: 2; color: var(--text-dim); font-size: 11px; }
  .left { color: var(--text-dim); }
  .mark { color: var(--look); }
  .left .mark { color: var(--text-dim); }
  .warning { padding: 4px 8px; border-left: 3px solid var(--telegraph); background: color-mix(in srgb, var(--telegraph) 8%, transparent); font-size: 12px; }
  .result { display: grid; gap: 6px; padding-top: 6px; border-top: 1px solid var(--line); }
</style>
