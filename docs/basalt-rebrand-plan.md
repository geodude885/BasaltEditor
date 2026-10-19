# Basalt Editor: rename and rebrand plan

Status: plan only, nothing changed yet. The open decisions at the end need answers before step 1.

## The line between Basalt and Boss Battles

Basalt is the **editor's** name. The chart format, the game and the shader packs keep theirs,
because they belong to the mod:

| Becomes Basalt | Stays Boss Battles / RUMBLE |
|---|---|
| package `name`, `productName`, `appId`, window and page titles | `.bbchart` extension (the mod reads it) |
| the brand in the top bar, Help, README, CLAUDE.md | `BossBattlesChart` in `model/chart.gen.ts` (generated from the mod's schema title) |
| `localStorage` keys (`bb-editor-*`) | `BossBattles Stage` / `BossBattles Night` pack names, `data/packs/BossBattlesStage.json` |
| GitHub repo and release artifact names | `UserData/BossBattles/Charts`, `../RumbleBossBattles*` paths in `scripts/sync-mod-data.mjs` and `src/main/index.ts` |
| the sample chart's "Made in…" comment (`model/samples.ts:40`) | "RUMBLE Boss Battles charts" wherever it describes *what* gets edited |

So "deep" means every place the code names the *app*, not the domain. A tagline keeps the link:
**Basalt - a chart editor for RUMBLE Boss Battles**.

## 1. Logo

The SVG is a clean three-shape mark (a basalt column read as a B) on a 555 x 542 box, one fill
`#4d4d4d`. Nudges:

- **Snap the near-misses.** `0.131` -> `0` on the left triangle; the bottom block's left edge runs
  `173.542 -> 176.747` (a 3-unit lean, looks accidental); the right-hand verticals lean ~0.4 units
  (`555.189/554.766`, `495.189/495.041`, `444.465/444`). Keep the corner chamfers - they're deliberate.
- **Square the box.** Pad to a square viewBox (e.g. `0 0 600 600`, mark centred) so it never
  stretches.
- **Fill `currentColor`, no `<style>`.** The mark then takes the theme's colour in the app. `#4d4d4d`
  is mid-grey: it vanishes on the dark UI and on a dark taskbar.
- **Small sizes.** The gaps are ~27 units: 1.6 px at 32 px, under 1 px at 16 px, where they blur shut.
  Make a 16/24 px variant with wider gaps (or the outer silhouette only) for the `.ico`.

Files:

- `src/renderer/src/assets/logo.svg` and `logo-small.svg` - the cleaned masters (committed).
- `src/renderer/src/components/Logo.svelte` - the mark inline, `currentColor`, used in the top bar
  and Help.
- App icon: the mark in light ash on a dark basalt rounded-square tile (macOS wants the tile and
  ~10% margin; Windows and Linux look fine with it too). `build/icon.png` 1024 px, plus a hand-made
  `build/icon.ico` carrying the small-size variant. This also closes the "no app icon yet" note in
  CLAUDE.md.
- `scripts/icons.mjs` (`npm run icons`) - rasterises the masters to the PNGs with Electron's
  offscreen rendering, which is already a dev dependency, so no new package. Outputs are committed.
- A favicon link in `index.html` so `npm run dev:renderer` shows it too; `icon` on the
  `BrowserWindow` for Linux.

## 2. Theme: Basalt dark, Ash light, follows the system

The current look (slate-blue floor, orange accent) is close already. Basalt shifts it to neutral
volcanic greys and keeps the orange as **ember** - it's also the game's lane colour, so it stays
meaningful.

### 2a. Tokens first (no visual change)

Today `app.css` has 20 variables, but ~30 colours are hard-coded elsewhere: `views/timeline/draw.ts`
(grid, rows, ruler), `views/lane/draw.ts` (floor), `views/theme.ts:39`, `Timeline.svelte:171`,
alpha tints in `App.svelte`, `TopBar`, `LooksPanel`, `PhasesPanel`, `ProblemsPanel`, and
`backgroundColor` in `src/main/index.ts`.

- Rename the variables semantically while touching them all: `--ground`->`--bg`, `--slab`->`--panel`,
  `--slab-2`->`--raised`, `--sand`->`--text`, `--dust`->`--text-dim`, `--lane`->`--accent`; keep the
  category colours (`--telegraph`, `--move`, `--clip`, `--look`, `--phase`, `--bad`, `--good`).
- Add the canvas-only ones: `--canvas-bg`, `--grid`, `--grid-beat`, `--grid-bar`, `--hover`.
- Tints use `color-mix(in srgb, var(--phase) 13%, transparent)` instead of `#4fd1a522`, so they follow
  the theme for free.
- **Stay fixed:** `model/constants.ts` lane colours and `WALL_COLOUR` - they're the game's in-world
  defaults (chart data), not UI.
- Land this alone and check it's pixel-identical before changing any colour.

### 2b. The palettes

| Token | Basalt (dark) | Ash (light) |
|---|---|---|
| `--bg` | `#131415` | `#f4f2ee` |
| `--panel` | `#1b1c1e` | `#eceae5` |
| `--raised` | `#25272a` | `#ffffff` |
| `--line` | `#35373b` | `#d4cfc6` |
| `--text` | `#e7e3dc` | `#1c1c1e` |
| `--text-dim` | `#9a958d` | `#6a655d` |
| `--accent` (ember) | `#ff7a1a` | `#c85a00` (orange text needs darkening for contrast on light) |
| category colours | as now | darker variants of each, checked for 4.5:1 as text |

Starting points to tune in the app, not final.

**The lane canvas follows the theme.** Its floor (`#1a1e23`, `#2a2622` in `views/lane/draw.ts`) and
marks become tokens like the timeline's. The catch: the lane's lines are drawn in the chart's own
colours (`model/constants.ts` defaults, or whatever the chart sets) - game colours that can't change
with the theme, and the defaults are light (zone line `#f2f2d9`, end lines `#ffd933`). On an Ash
floor they'd vanish. So the light floor is a mid ash (around `#c9c4ba`, not page white), and chart
colours are drawn with a thin dark keyline under them in the light theme so any colour reads.

### 2c. The toggle

- `editor.theme: "system" | "dark" | "light"`, persisted as `basalt-theme`. Applied as `data-theme`
  on `<html>`; "system" uses `prefers-color-scheme`.
- `views/theme.ts` caches the colours once - it needs a reactive theme version (a `$state` counter
  bumped on change, read by `theme()`), so the canvas `$effect`s redraw.
- Main process: an IPC channel in `shared/api.ts` sets `nativeTheme.themeSource`, so the title bar
  and dialogs match; `backgroundColor` reads `nativeTheme.shouldUseDarkColors` to avoid a flash.
- UI: a small three-way control at the right of the top bar (or in Help if the bar is crowded).

## 3. The rename

**Identity**

- `package.json`: `name: basalt-editor`, `productName: Basalt Editor`, `description: "Basalt - a chart
  editor for RUMBLE Boss Battles"`. Bump to `0.2.0`.
- `electron-builder.yml`: `appId: com.acutiepi.basalt`, `productName: Basalt Editor`. Artifacts become
  `basalt-editor-0.2.0-win-x64.exe` etc. via `${name}`. Consider `fileAssociations` for `.bbchart`
  while here (opening one by double-click needs an `open-file` / argv handler in main).
- Titles: `index.html:10`, `App.svelte:26` (`… - Basalt Editor`).
- Top bar brand (`TopBar.svelte:11`): `<Logo/> Basalt Editor`, accent on the mark rather than half the word.
- Help panel: a short header with the mark, name, version and the tagline.
- `store/document.svelte.ts`, `store/editor.svelte.ts`: keys `bb-editor-*` -> `basalt-*`, reading the
  old key once as a fallback then deleting it.
- README, CLAUDE.md (title, intro, the icon note), `model/samples.ts:40`.

**Moving users across (the part that's easy to get wrong)**

- **userData moves.** Electron puts `localStorage` under `%APPDATA%/<productName>`. Renaming moves it
  to `…/Basalt Editor`, losing drafts and settings. In main, before the first window: if the new
  folder has no `Local Storage` and `…/Boss Battles Chart Editor/Local Storage` exists, copy it over.
- **A new appId is a new app on Windows.** The NSIS installer puts Basalt beside the old one; old
  installs auto-update into a second app and leave the old shortcut. Changing it at 0.1.x, with few
  users, is the cheapest time. Release notes say "uninstall Boss Battles Chart Editor".
- **Repo rename** `RumbleBossBattlesEditor` -> `BasaltEditor`: update `publish.repo`. GitHub
  redirects the old name, so old installs still find the release - test with an installed 0.1.2
  before publishing the draft. Rename the local folder afterwards (Claude's project memory is keyed
  by path, so it starts fresh).

## Order

1. ~~Logo cleanup + icon pipeline + `Logo.svelte`~~ - done.
2. Tokens refactor, pixel-identical (independent of 1).
3. Palettes + toggle.
4. Rename + migration + version bump.
5. Repo rename, release `v0.2.0`, check an old install updates.

1 and 2 can run in parallel; 3 needs 2; 4 needs 1.

## Decisions (2026-10-19)

1. **Name:** "Basalt Editor" - product name, window and page titles, top bar.
2. **appId:** changes to `com.acutiepi.basalt`.
3. **Boss Battles only:** Basalt never edits other mods' charts, so `.bbchart`, `BossBattlesChart` and
   the pack names stay as they are - no adapter layer.
4. **Lane canvas follows the theme** (see 2b for how chart colours stay readable).
5. **Logo:** option A (ash mark on the basalt tile). Masters in `src/renderer/src/assets/`; `npm run icons`
   writes `build/icon.png`, `build/icon.ico` (16-32 px frames from the small mark) and the favicon.
