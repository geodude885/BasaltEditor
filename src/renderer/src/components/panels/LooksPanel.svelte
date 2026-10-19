<script lang="ts">
  import {
    colourChannels, cssToLinear, cueSetsParameter, isCueForPack, isNightCue, linearToCss,
    setStageCueColour, setStageCueSetting, settingsWrittenIn, STAGE_PACK, stageCueValue, stageCueWarnings, stageLookAfterCue,
    stageLookBeforeCue, stageParameterGroups, stagePreview, type PackParameter, type Rgb, type StageLook,
  } from "../../model/looks";
  import { evTime } from "../../model/chart";
  import { round } from "../../model/tempo";
  import type { LookCue } from "../../model/types";
  import { addStageCueAtPlayhead, convertNightCuesToStage, removeLookCue, selectLookCue } from "../../store/actions";
  import { doc } from "../../store/document.svelte";
  import { editor } from "../../store/editor.svelte";
  import { seek } from "../../store/playback";
  import { checked, num, text } from "../fields";

  const groups = stageParameterGroups();
  const visuals = $derived(doc.chart.visuals ?? []);
  const nightCueCount = $derived(visuals.filter(isNightCue).length);
  const index = $derived(editor.selectedLookCue);
  const cue = $derived<LookCue | undefined>(visuals[index]);
  const isStageCue = $derived(!!cue && isCueForPack(cue, STAGE_PACK));
  const startsFrom = $derived<StageLook | null>(cue && isStageCue ? stageLookBeforeCue(editor.lookCues, index) : null);
  const fadesTo = $derived<StageLook | null>(cue && startsFrom ? stageLookAfterCue(startsFrom, cue) : null);

  const editSelectedCue = (mutate: (cue: LookCue) => void) => doc.change(["visuals"], () => mutate(doc.chart.visuals![index]));

  const shownValue = (parameter: PackParameter): number => cue ? stageCueValue(cue, parameter) ?? startsFrom!.settings[parameter.property] : parameter.default;
  const sliderStep = (parameter: PackParameter) => (parameter.max - parameter.min) / 200;
  const shownColour = (colour: string): string => linearToCss(colourChannels(colour).map(shownValue) as Rgb);
  const cueSetsColour = (colour: string) => !!cue && colourChannels(colour).some(p => cueSetsParameter(cue, p));
  const colourLabel = (colour: string) => colour.replace(/ colour$/, "");

  function cueSummary(c: LookCue): string {
    if (c.off) return "turns off";
    const count = settingsWrittenIn(c).length;
    return count ? `sets ${count}` : "turns on";
  }

  function cueTimeLabel(c: LookCue): string {
    if (c.beat != null) return `beat ${c.beat}`;
    return c.t != null ? `${c.t} s` : "no time";
  }

  function setMode(mode: string): void {
    editSelectedCue(c => {
      if (mode === "off") { delete c.set; delete c.on; c.off = true; }
      else { delete c.off; if (!settingsWrittenIn(c).length) c.on = true; }
    });
  }
</script>

{#snippet swatches(look: StageLook, caption: string)}
  {@const preview = stagePreview(look)}
  <div class="swatches" title={look.on ? "The sky, the arena around you, and something in the key colour" : "The pack is off: the player's own look"}>
    <span style:background={preview.sky}></span><span style:background={preview.surroundings}></span><span style:background={preview.keyColoured}></span>
    <small>{caption}{look.on ? "" : " (off)"}</small>
  </div>
{/snippet}

<div class="row">
  <button class="primary" title="A BossBattles Stage cue at the playhead (or double-click the timeline's looks row)" onclick={addStageCueAtPlayhead}>+ Look at the playhead</button>
  {#if nightCueCount}
    <button onclick={convertNightCuesToStage}>Convert {nightCueCount} BossBattles Night cue{nightCueCount === 1 ? "" : "s"} to Stage</button>
    <span class="note">Converted cues carry Night's look with them, so the chart looks the same - then use Stage's colours, fog and beat flashes.</span>
  {/if}
</div>

{#if visuals.length}
  <div class="cues" role="listbox" aria-label="Look cues">
    {#each visuals as c, i (i)}
      <button role="option" aria-selected={i === index} class:stage={isCueForPack(c, STAGE_PACK)}
        onclick={() => { selectLookCue(i); const time = evTime(c, doc.tempo); if (Number.isFinite(time)) seek(time); }}>
        <b>{cueTimeLabel(c)}</b><span>{c.pack}</span><span>{cueSummary(c)}{c.fade ? ` · ${c.fade} s fade` : ""}</span>
      </button>
    {/each}
  </div>
{:else}
  <div class="note">
    No looks yet. Looks are RumbleReShaded shader settings over time, for players who have it: add one at the playhead, set what it
    changes, and give it a fade. Each look fades from where the last one left off.
  </div>
{/if}

{#if cue}
  <div class="cue">
    <div class="row">
      <h3>Look at {cueTimeLabel(cue)}</h3>
      <span class="note">{cue.pack}</span>
      <button onclick={() => removeLookCue(index)}>Delete</button>
    </div>

    <div class="grid3">
      {#if cue.beat != null}
        <label><span>Beat</span><input type="number" step="1" min="0" value={cue.beat} onchange={e => editSelectedCue(c => { c.beat = Math.max(0, num(e)); })} /></label>
      {:else}
        <label><span>Time (s)</span><input type="number" step="0.1" min="0" value={cue.t ?? 0} onchange={e => editSelectedCue(c => { c.t = round(Math.max(0, num(e)), 3); })} /></label>
      {/if}
      <label><span>Fade (s)</span><input type="number" step="0.1" min="0" value={cue.fade ?? 0} onchange={e => editSelectedCue(c => { const fade = Math.max(0, num(e) || 0); if (fade) c.fade = fade; else delete c.fade; })} /></label>
      <label><span>Does</span>
        <select value={cue.off ? "off" : "set"} onchange={e => setMode(text(e))}>
          <option value="set">sets the look</option><option value="off">fades back to the player's own, then off</option>
        </select>
      </label>
    </div>

    {#if isNightCue(cue)}
      <div class="note">A BossBattles Night cue. Convert the chart's Night cues (above) to edit them here.</div>
    {/if}

    {#if !isStageCue}
      <div class="list">
        {#each settingsWrittenIn(cue) as [name, value] (name)}
          <div class="item">
            <label><span>{name}</span><input type="number" step="0.05" {value} onchange={e => editSelectedCue(c => { c.set = { ...c.set, [name]: num(e) }; })} /></label>
          </div>
        {/each}
      </div>
      <div class="note">The editor knows BossBattles Stage's settings; other packs' are shown as written.</div>
    {:else if startsFrom && fadesTo}
      <div class="row">
        {@render swatches(startsFrom, "starts from")}
        <span class="arrow">→</span>
        {@render swatches(fadesTo, cue.fade ? `after ${cue.fade} s` : "at once")}
      </div>
      {#each stageCueWarnings(cue) as warning (warning)}<div class="warning">{warning}</div>{/each}

      {#if !cue.off}
        <div class="note">Ticked settings are this look's; the rest carry on from before it.</div>
        <div class="groups">
          {#each groups as group (group.name)}
            <section>
              <h3>{group.name}</h3>
              {#each group.settings as parameter (parameter.property)}
                {@const sets = cueSetsParameter(cue, parameter)}
                <div class="setting" class:inherited={!sets}>
                  <input type="checkbox" checked={sets} title={sets ? "Stop setting this here" : "Set this here"}
                    onchange={e => editSelectedCue(c => setStageCueSetting(c, parameter, checked(e) ? shownValue(parameter) : undefined))} />
                  <span class="name">{parameter.label}</span>
                  <input type="range" min={parameter.min} max={parameter.max} step={sliderStep(parameter)} value={shownValue(parameter)}
                    class:hue={parameter.property === "_KeyHue"}
                    onchange={e => editSelectedCue(c => setStageCueSetting(c, parameter, num(e)))} />
                  <input type="number" min={parameter.min} max={parameter.max} step={sliderStep(parameter)} value={round(shownValue(parameter), 3)}
                    onchange={e => editSelectedCue(c => setStageCueSetting(c, parameter, num(e)))} />
                </div>
              {/each}
              {#each group.colours as colour (colour)}
                {@const sets = cueSetsColour(colour)}
                <div class="setting" class:inherited={!sets}>
                  <input type="checkbox" checked={sets} title={sets ? "Stop setting this here" : "Set this here"}
                    onchange={e => editSelectedCue(c => setStageCueColour(c, colour, checked(e) ? colourChannels(colour).map(shownValue) as Rgb : undefined))} />
                  <span class="name">{colourLabel(colour)} colour</span>
                  <input type="color" value={shownColour(colour)} onchange={e => editSelectedCue(c => setStageCueColour(c, colour, cssToLinear(text(e))))} />
                  <span class="channels">{colourChannels(colour).map(p => round(shownValue(p), 3)).join(" · ")}</span>
                </div>
              {/each}
            </section>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .cues { display: flex; flex-wrap: wrap; gap: 6px; }
  .cues button { display: grid; gap: 1px; text-align: left; font-size: 12px; padding: 4px 8px; }
  .cues button span { color: var(--text-dim); }
  .cues button.stage { border-left: 3px solid var(--look); }
  .cues button[aria-selected="true"] { border-color: var(--look); background: color-mix(in srgb, var(--look) 13%, transparent); }
  .cue { display: grid; gap: 10px; padding-top: 8px; border-top: 1px solid var(--line); }
  .cue h3 { margin: 0; }
  .swatches { display: grid; grid-template-columns: repeat(3, 28px); gap: 2px; align-items: center; }
  .swatches span { height: 20px; border-radius: 3px; border: 1px solid var(--line); }
  .swatches small { grid-column: 1 / -1; color: var(--text-dim); font-size: 11px; }
  .arrow { color: var(--text-dim); }
  .warning { padding: 4px 8px; border-left: 3px solid var(--telegraph); background: color-mix(in srgb, var(--telegraph) 8%, transparent); font: 12px var(--mono); }
  .groups { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
  section { display: grid; gap: 4px; padding: 8px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); align-content: start; }
  .setting { display: grid; grid-template-columns: auto 9.5em minmax(60px, 1fr) 5.5em; gap: 6px; align-items: center; font-size: 12px; }
  .setting.inherited .name, .setting.inherited .channels { color: var(--text-dim); }
  .setting input[type=color] { width: 100%; height: 22px; padding: 0 2px; }
  .channels { font: 11px var(--mono); }
  input.hue { accent-color: var(--text); background: linear-gradient(90deg, red, yellow, lime, cyan, blue, magenta, red); height: 6px; border-radius: 3px; }
</style>
