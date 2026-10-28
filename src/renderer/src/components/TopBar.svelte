<script lang="ts">
  // The desktop layout's top bar: the menus, the chart, Save, Undo/Redo, the problem count and the theme.
  // What the menus do is in store/commands.ts.
  import { appearance, THEME_CHOICES, THEME_NAMES, type ThemeChoice } from "../store/appearance.svelte";
  import { commandButton } from "../store/commands";
  import { saveTarget } from "../store/files";
  import { doc } from "../store/document.svelte";
  import { session } from "../store/session.svelte";
  import { ui } from "../store/ui.svelte";
  import BuildBadge from "./BuildBadge.svelte";
  import Logo from "./Logo.svelte";
  import MenuBar from "./MenuBar.svelte";

  const count = $derived(session.problems.length);
</script>

<header class="bar">
  <div class="brand"><Logo size={26} /> Basalt <span>Editor</span></div>
  <BuildBadge />
  <MenuBar />
  <div class="chartname" title={session.folder ?? doc.name}>{doc.chart.name || "Untitled"}{doc.dirty ? " •" : ""}</div>
  <div class="spacer"></div>
  <div class="group">
    <button class="primary" {...commandButton("save")}>{saveTarget() === "file" ? "Save as…" : "Save"}</button>
    <button {...commandButton("undo")}>Undo</button>
    <button {...commandButton("redo")}>Redo</button>
    <button class="chip" class:bad={count} class:ok={!count} onclick={() => { ui.tab = "problems"; }}>
      {count ? `${count} problem${count === 1 ? "" : "s"}` : "no problems"}
    </button>
    <select class="theme" title="Light or dark" aria-label="Theme" value={appearance.choice}
      onchange={e => appearance.choose(e.currentTarget.value as ThemeChoice)}>
      {#each THEME_CHOICES as choice (choice)}<option value={choice}>{THEME_NAMES[choice]}</option>{/each}
    </select>
  </div>
</header>

<style>
  .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding-block: 10px; border-bottom: 1px solid var(--line); }
  .brand { display: flex; align-items: center; gap: 8px; font: 700 22px/1 var(--display); letter-spacing: .02em; text-transform: uppercase; }
  .brand span { color: var(--text-dim); }
  .theme { font-size: 12px; }
  .group { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .spacer { flex: 1; }
  .chartname { font: 600 18px/1.1 var(--display); color: var(--text); max-width: 22ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chip { font: 500 12px var(--mono); padding: 3px 8px; border-radius: 999px; border: 1px solid var(--line); background: none; }
  .chip.ok { color: var(--good); border-color: color-mix(in srgb, var(--good) 33%, transparent); }
  .chip.bad { color: var(--bad); border-color: color-mix(in srgb, var(--bad) 40%, transparent); }
</style>
