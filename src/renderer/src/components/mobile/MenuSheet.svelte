<script lang="ts">
  // The phone layout's menu: files, playback settings and the theme - what the desktop's top bar and
  // transport hold, gathered behind one button.
  import { appearance, THEME_CHOICES, type ThemeChoice } from "../../store/appearance.svelte";
  import { editor } from "../../store/editor.svelte";
  import { copyChart, openFiles, openFolder, save, saveChartAs, savePackage } from "../../store/files";
  import { mobile } from "../../store/mobile.svelte";
  import { ensureAudio, setRate, setVolume } from "../../store/playback";
  import { recording } from "../../store/recording.svelte";
  import { canOpenFolders } from "../../platform/web";
  import { num } from "../fields";
  import SongPicker from "../SongPicker.svelte";

  const THEME_NAMES: Record<ThemeChoice, string> = { system: "System theme", dark: "Basalt (dark)", light: "Ash (light)" };
  const showOpenFolder = canOpenFolders();

  /** Runs a menu action and shuts the menu. */
  const then = (action: () => unknown) => () => { mobile.menu = false; void action(); };
</script>

<button class="scrim" aria-label="Close the menu" onclick={() => { mobile.menu = false; }}></button>
<div class="sheet" role="dialog" aria-label="Menu">
  <h3>Chart</h3>
  <div class="actions">
    <button onclick={then(() => { editor.confirmNew = true; mobile.drawer = "chart"; })}>New</button>
    <button onclick={then(openFiles)}>Open files…</button>
    {#if showOpenFolder}<button onclick={then(openFolder)}>Open folder…</button>{/if}
    <button class="primary" onclick={then(save)}>{editor.folder ? "Save" : "Save as…"}</button>
    {#if editor.folder}<button onclick={then(saveChartAs)}>Save as…</button>{/if}
    <button onclick={then(savePackage)}>Package…</button>
    <button onclick={then(copyChart)}>Copy chart.json</button>
  </div>
  <SongPicker />
  <h3>Playing</h3>
  <div class="settings">
    <label><span>Speed</span>
      <select value={String(editor.rate)} onchange={e => setRate(num(e))}>
        <option value="1">100%</option><option value="0.75">75%</option><option value="0.5">50%</option><option value="0.25">25%</option>
      </select>
    </label>
    <label><span>Volume</span>
      <input type="range" min="0" max="1" step="0.05" value={editor.volume} oninput={e => setVolume(num(e))} />
    </label>
    <button class:on={editor.click} onclick={() => { editor.click = !editor.click; ensureAudio(); }}>Beat click</button>
    <label class="wide"><span>Tap timing: {recording.offsetMs > 0 ? "−" : recording.offsetMs < 0 ? "+" : ""}{Math.abs(recording.offsetMs)} ms</span>
      <input type="range" min="-150" max="250" step="5" value={recording.offsetMs} oninput={e => recording.setOffset(num(e))}
        aria-describedby="offset-note" />
    </label>
    <p class="note" id="offset-note">If your taps land late, move this right; early, move it left.</p>
  </div>
  <h3>Look</h3>
  <div class="settings">
    <select aria-label="Theme" value={appearance.choice} onchange={e => appearance.choose(e.currentTarget.value as ThemeChoice)}>
      {#each THEME_CHOICES as choice (choice)}<option value={choice}>{THEME_NAMES[choice]}</option>{/each}
    </select>
    <a href="?mobile=0">Desktop layout</a>
  </div>
</div>

<style>
  .scrim { position: absolute; inset: 0; border: 0; border-radius: 0; background: color-mix(in srgb, var(--bg) 60%, transparent); z-index: 6; }
  .sheet {
    position: absolute; top: 0; left: 0; bottom: 0; width: min(360px, 86vw); z-index: 7; overflow: auto; overscroll-behavior: contain;
    background: var(--panel); border-right: 1px solid var(--line); padding: 12px 14px; padding-left: max(14px, env(safe-area-inset-left));
    display: grid; gap: 10px; align-content: start;
  }
  .actions, .settings { display: flex; flex-wrap: wrap; gap: 8px; align-items: end; }
  button, select { min-height: 40px; }
  label { flex: 1 1 120px; }
  label.wide { flex-basis: 100%; }
  .note { margin: 0; font-size: 12px; }
  a { align-self: center; }
</style>
