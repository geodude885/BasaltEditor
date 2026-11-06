<script lang="ts">
  // Several looks selected: their fade and what they do, and every Stage setting, set for all of them at once. A
  // setting some of them set and some don't shows a dash in its tick; one they set differently shows "mixed" until
  // it's set. Each change is one undo step for the lot. Their times stay their own - drag them on the timeline.
  import { MIXED } from "../../model/batch";
  import { colourAcross, fadeAcross, modeAcross, settingAcross, valueToSet } from "../../model/lookBatch";
  import {
    colourChannels, cssToLinear, isCueForPack, linearToCss, setStageCueColour, setStageCueSetting, STAGE_PACK, stageCueValue,
    stageParameterGroups, type PackParameter, type Rgb,
  } from "../../model/looks";
  import { SIMPLIFY_CLOSENESS, SIMPLIFY_TOLERANCE, simplifyLooks } from "../../model/simplify";
  import { round } from "../../model/tempo";
  import type { LookCue } from "../../model/types";
  import { editSelectedLooks, simplifySelectedLooks } from "../../store/actions";
  import { commandButton } from "../../store/commands";
  import { doc } from "../../store/document.svelte";
  import { editing } from "../../store/editing.svelte";
  import { checked, num, text } from "../fields";

  const groups = stageParameterGroups();
  const cues = $derived([...editing.selectedLooks].map(i => doc.chart.shaders?.[i]).filter((c): c is LookCue => !!c));
  const allStage = $derived(cues.length > 0 && cues.every(c => isCueForPack(c, STAGE_PACK)));
  const fade = $derived(fadeAcross(cues));
  let closeness = $state(SIMPLIFY_TOLERANCE);
  /** How many looks simplifying would leave, so the button can say. */
  const simplifiedTo = $derived(simplifyLooks(doc.chart, doc.tempo, editing.selectedLooks, { tolerance: closeness }).add.length || cues.length);
  const mode = $derived(modeAcross(cues));

  const sliderStep = (p: PackParameter) => (p.max - p.min) / 200;
  const colourLabel = (colour: string) => colour.replace(/ colour$/, "");
  /** A number field's value, or blank (showing "mixed") where they differ. */
  const shownNumber = (value: number | typeof MIXED | null, fallback: number) => value === MIXED ? "" : round(value ?? fallback, 3);
  /** A tick that shows a dash when some of them set it and some don't. */
  const someOf = (node: HTMLInputElement, some: boolean) => { node.indeterminate = some; return { update: (now: boolean) => { node.indeterminate = now; } }; };

  /** Sets a number on every look, leaving them alone when the field is left blank. */
  function setAll(event: Event, apply: (cue: LookCue, n: number) => void): void {
    const n = num(event);
    if (Number.isFinite(n)) editSelectedLooks(cue => apply(cue, n));
  }

  function tick(parameter: PackParameter, on: boolean): void {
    const value = valueToSet(cues, parameter);
    editSelectedLooks(cue => { if (!on) setStageCueSetting(cue, parameter, undefined); else if (stageCueValue(cue, parameter) === undefined) setStageCueSetting(cue, parameter, value); });
  }

  function tickColour(colour: string, on: boolean): void {
    const channels = colourChannels(colour), value = channels.map(p => valueToSet(cues, p)) as Rgb;
    editSelectedLooks(cue => {
      if (!on) setStageCueColour(cue, colour, undefined);
      else if (channels.every(p => stageCueValue(cue, p) === undefined)) setStageCueColour(cue, colour, value);
    });
  }

  function setMode(next: string): void {
    if (next !== "set" && next !== "off") return;
    editSelectedLooks(cue => { if (next === "off") { delete cue.values; cue.off = true; } else delete cue.off; });
  }
</script>

<div class="batch">
  <div class="row">
    <h3>{cues.length} looks selected</h3>
    <span class="spacer"></span>
    <select aria-label="How closely to keep to them" title="How closely the simplified looks keep to these: Close within 6% of any setting, Loose 15%, Rough 30%"
      value={closeness} onchange={e => { closeness = +text(e); }}>
      {#each SIMPLIFY_CLOSENESS as option (option.tolerance)}<option value={option.tolerance}>{option.label}</option>{/each}
    </select>
    <button title="Fewer looks in their place that look much the same: only the moments a fade wouldn't reach" disabled={simplifiedTo >= cues.length}
      onclick={() => simplifySelectedLooks(false, closeness)}>Simplify to {simplifiedTo}</button>
    <button title="One look in place of them all, fading from the first's time to where the last ends up" onclick={() => simplifySelectedLooks(true)}>Merge into one</button>
    <button {...commandButton("delete")}>Delete them</button>
  </div>
  <div class="note">
    Set any of these for all {cues.length}. A dash in a tick means some of them set it; "mixed" means they set it differently.
    Their times stay their own: drag them on the timeline to move them together.
  </div>
  <div class="grid2">
    <label><span>Fade (s)</span>
      <input type="number" step="0.1" min="0" placeholder="mixed" value={fade === MIXED ? "" : fade}
        onchange={e => setAll(e, (cue, n) => { const f = Math.max(0, n); if (f) cue.fade = f; else delete cue.fade; })} />
    </label>
    <label><span>Does</span>
      <select value={mode === MIXED ? "" : mode} onchange={e => setMode(text(e))}>
        {#if mode === MIXED}<option value="" disabled>mixed</option>{/if}
        <option value="set">sets the look</option><option value="off">fades back to the player's own, then off</option>
      </select>
    </label>
  </div>

  {#if !allStage}
    <div class="note">Not all of them are BossBattles Stage looks, so only their fade and what they do can be set together.</div>
  {:else if mode !== "off"}
    <div class="groups">
      {#each groups as group (group.name)}
        <section>
          <h3>{group.name}</h3>
          {#each group.settings as parameter (parameter.property)}
            {@const across = settingAcross(cues, parameter)}
            <div class="setting" class:inherited={across.sets === "none"}>
              <input type="checkbox" checked={across.sets === "all"} use:someOf={across.sets === "some"}
                title={across.sets === "all" ? "Stop setting this in all of them" : "Set this in all of them"} onchange={e => tick(parameter, checked(e))} />
              <span class="name">{parameter.label}</span>
              <input type="range" min={parameter.min} max={parameter.max} step={sliderStep(parameter)}
                value={typeof across.value === "number" ? across.value : valueToSet(cues, parameter)} class:mixed={across.value === MIXED}
                onchange={e => setAll(e, (cue, n) => setStageCueSetting(cue, parameter, n))} />
              <input type="number" min={parameter.min} max={parameter.max} step={sliderStep(parameter)} placeholder="mixed"
                value={shownNumber(across.value, parameter.default)} onchange={e => setAll(e, (cue, n) => setStageCueSetting(cue, parameter, n))} />
            </div>
          {/each}
          {#each group.colours as colour (colour)}
            {@const across = colourAcross(cues, colour)}
            {@const shownColour = across.value && across.value !== MIXED ? across.value : colourChannels(colour).map(p => valueToSet(cues, p)) as Rgb}
            <div class="setting" class:inherited={across.sets === "none"}>
              <input type="checkbox" checked={across.sets === "all"} use:someOf={across.sets === "some"}
                title={across.sets === "all" ? "Stop setting this in all of them" : "Set this in all of them"} onchange={e => tickColour(colour, checked(e))} />
              <span class="name">{colourLabel(colour)} colour</span>
              <input type="color" value={linearToCss(shownColour)} onchange={e => editSelectedLooks(cue => setStageCueColour(cue, colour, cssToLinear(text(e))))} />
              <span class="channels">{across.value === MIXED ? "mixed" : shownColour.map(v => round(v, 3)).join(" · ")}</span>
            </div>
          {/each}
        </section>
      {/each}
    </div>
  {/if}
</div>

<style>
  .batch { display: grid; gap: 10px; padding-top: 8px; border-top: 1px solid var(--line); }
  .batch h3 { margin: 0; }
  .spacer { flex: 1; }
  .groups { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
  section { display: grid; gap: 4px; padding: 8px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); align-content: start; }
  .setting { display: grid; grid-template-columns: auto 9.5em minmax(60px, 1fr) 5.5em; gap: 6px; align-items: center; font-size: 12px; }
  .setting.inherited .name, .setting.inherited .channels { color: var(--text-dim); }
  .setting input[type=color] { width: 100%; height: 22px; padding: 0 2px; }
  input.mixed { opacity: .45; }
  .channels { font: 11px var(--mono); }
</style>
