<script lang="ts">
  // The phone layout's menu: the command table's File, Edit and Playback menus, then the playing
  // settings and the look of the editor - the theme, projectile colours and the look preview - what the
  // desktop's menu bar and transport hold, behind one button.
  import { dismissable } from "../gestures";
  import { panel, veil } from "../motion";
  import { appearance, THEME_CHOICES, THEME_NAMES, type ThemeChoice } from "../../store/appearance.svelte";
  import { commandButton, menus, visibleGroups, type Command } from "../../store/commands";
  import { editor } from "../../store/editor.svelte";
  import { mobile } from "../../store/mobile.svelte";
  import { setRate, setVolume } from "../../store/playback";
  import { num } from "../fields";
  import { SHOT_COLOURINGS, type ShotColouring } from "../../views/shotColours";
  import ShotLegend from "../ShotLegend.svelte";
  import SongPicker from "../SongPicker.svelte";
  import TapOffset from "../TapOffset.svelte";

  // View's editors are in the top bar here, and its settings under Look; the rest of the table is drawn as it is.
  const shown = $derived(menus().filter(m => m.id !== "view"));

  /** Runs a command and shuts the menu. */
  function run(command: Command): void {
    mobile.menu = false;
    void command.run();
  }
</script>

<button class="scrim" in:veil out:veil aria-label="Close the menu" onclick={() => { mobile.menu = false; }}></button>
<div class="sheet" role="dialog" aria-label="Menu" in:panel={{ from: "left" }} out:panel={{ from: "left" }}
  use:dismissable={{ axis: "x", toward: -1, onClose: () => { mobile.menu = false; } }}>
  {#each shown as menu (menu.id)}
    <h3>{menu.label}</h3>
    {#each visibleGroups(menu) as group, g (g)}
      <div class="actions">
        {#each group as command (command.id)}
          <button class:primary={command.id === "save" || command.id === "library"} class:on={command.checked?.()}
            disabled={command.enabled ? !command.enabled() : false} onclick={() => run(command)}>{command.label}</button>
        {/each}
      </div>
    {/each}
    {#if menu.id === "file"}<SongPicker />{/if}
  {/each}
  <h3>Settings</h3>
  <div class="settings">
    <label><span>Speed</span>
      <select value={String(editor.rate)} onchange={e => setRate(num(e))}>
        <option value="1">100%</option><option value="0.75">75%</option><option value="0.5">50%</option><option value="0.25">25%</option>
      </select>
    </label>
    <label><span>Volume</span>
      <input type="range" min="0" max="1" step="0.05" value={editor.volume} oninput={e => setVolume(num(e))} />
    </label>
    <div class="wide"><TapOffset /></div>
    <p class="note">If your taps land late, move Tap timing right; early, move it left.</p>
  </div>
  <h3>Look</h3>
  <div class="settings">
    <select aria-label="Theme" value={appearance.choice} onchange={e => appearance.choose(e.currentTarget.value as ThemeChoice)}>
      {#each THEME_CHOICES as choice (choice)}<option value={choice}>{THEME_NAMES[choice]}</option>{/each}
    </select>
    <a href="?mobile=0">Desktop layout</a>
    <label class="wide"><span>Projectile colours</span>
      <select value={editor.shotColouring} onchange={e => editor.colourShotsBy(e.currentTarget.value as ShotColouring)}>
        {#each SHOT_COLOURINGS as [colouring, label] (colouring)}<option value={colouring}>{label}</option>{/each}
      </select>
    </label>
    <div class="wide"><ShotLegend /></div>
    <button {...commandButton("look-preview")}>Look preview</button>
  </div>
</div>

<style>
  .scrim { position: absolute; inset: 0; border: 0; border-radius: 0; background: color-mix(in srgb, var(--bg) 60%, transparent); z-index: 6; }
  .sheet {
    position: absolute; top: 0; left: 0; bottom: 0; width: min(360px, 86vw); z-index: 7; overflow: auto; overscroll-behavior: contain;
    background: var(--panel); border-right: 1px solid var(--line); padding: max(12px, env(safe-area-inset-top)) 14px max(12px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left));
    display: grid; gap: 10px; align-content: start;
    /* It scrolls up and down; a sideways drag closes it (components/gestures.ts). */
    touch-action: pan-y;
  }
  .actions, .settings { display: flex; flex-wrap: wrap; gap: 8px; align-items: end; }
  button, select { min-height: 40px; }
  label { flex: 1 1 120px; }
  .wide { flex-basis: 100%; display: grid; }
  .note { margin: 0; font-size: 12px; }
  a { align-self: center; }
</style>
