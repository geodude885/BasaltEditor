# Working on Basalt Editor

Basalt Editor (formerly the Boss Battles Chart Editor) is a desktop editor for charts of Basalt, the
RUMBLE boss battle mod (formerly BossBattles): `chart.json` plus song, cover and clips, packaged as
`.bbchart`. Charts live in `UserData/Basalt/Charts`, and the mod's schema generates `BasaltChart`. Two
names kept from before the rename belong to the mod and its packs, not the editor: the `.bbchart`
extension and the shader pack name ("BossBattles Stage"). It replaced the single-file HTML editor that used to ship inside the mod; the mod no
longer bundles an editor. `README.md` covers the commands.

## Stack

**Electron + electron-vite + Svelte 5 + TypeScript + Vitest**, packaged by electron-builder and
released on GitHub Releases.

- **Plain Svelte + Vite, not SvelteKit, not Next.js.** Both are server frameworks (SSR, routing,
  server components); a desktop editor uses none of it, and their routing and asset paths fight
  loading from `file://` inside Electron.
- **Pinned on purpose:** Vite 7 and `@sveltejs/vite-plugin-svelte` 6 (electron-vite 5 does not take
  Vite 8 yet), TypeScript 6 (svelte-check does not take TypeScript 7). Check the peers before bumping.
- **npm blocks install scripts** unless `allowScripts` in `package.json` lists them; esbuild and
  electron-winstaller are approved. A new dependency that needs one: `npm install-scripts ls`, then
  `npm install-scripts approve <pkg>` after checking it.
- **Few dependencies, on purpose.** Write small UI pieces (fields, tabs, dialogs, toasts) ourselves
  rather than pulling in a component library. The exceptions are things that are easy to get subtly
  wrong and someone else maintains:
  - `electron-builder` - packaging, signing, publishing.
  - `electron-updater` - auto-update from GitHub Releases. The only runtime dependency.
  - `fflate` - if packages ever need writing deflated; `io/zip.ts` reads deflate but writes stored
    entries only.
  - Fonts come from `@fontsource/*` (dev dependencies: Vite bundles them, so the app works offline
    and the CSP can stay `'self'`).

## Svelte 5 runes only

Models have seen far more Svelte 4 than Svelte 5 and will mix the two. In this repo:

- `$state`, `$derived`, `$effect`, `$props`, `$bindable` - never `export let`, `$:` statements or
  `svelte/store` stores.
- Event attributes (`onclick={...}`), not `on:click`. Snippets (`{#snippet}` / `{@render}`), not slots.
- State shared across components lives in `.svelte.ts` modules (`store/`) exporting class
  instances with `$state` fields. Runes only work in `.svelte` and `.svelte.ts` files - a plain `.ts`
  that needs a deep copy of state uses `JSON.parse(JSON.stringify(x))`.
- `{@const}` must sit directly inside a block (`{#if}`, `{#each}`...), not inside an element - use a
  `$derived` in the script instead.
- `onwheel` and touch handlers may be registered passive, so `preventDefault` does nothing: attach
  them with `addEventListener(..., { passive: false })` in an `$effect`.
- When unsure, check Svelte's own docs for LLMs (`https://svelte.dev/llms.txt`) rather than guessing.

## Shape

```
src/main/       Electron main: window, dialogs, file access (folders the user opened, the Charts folder)
src/preload/    exposes src/shared/api.ts to the page as window.editor
src/shared/     the API between them - types and IPC channel names
src/renderer/src/
  model/        chart types, JSONC, tempo, validation (problems), edits, looks and the look preview's
                painted arena (stageFrame) - pure TypeScript
  io/           zip, sorting opened files into a chart and its song, cover and clips, what a package
                holds, chart summaries for "Your charts"
  audio/        waveform peaks, MP3 inside a WAV
  store/        document (text, chart, undo, looks), editing (selection, snap), transport (playhead,
                playing, volume), display (which editor, timeline view, preview, colours), session
                (files beside the chart, where it saves, problems), ui (tabs, toasts, quick actions);
                actions, files, playback, commands and keyboard, practice, recording, library, layout
  views/lane/   lane canvas: geometry, draw, interaction (what a press hits), the component
  views/timeline/  timeline canvas: rows and markers, draw, interaction, the component
  views/highway/   note-highway editor: columns, tiles, draw, interaction, the component
  components/   top bar and menu bar, transport, inspector, highway screen, quick actions, the tab
                panels (panels/tabs.ts lists them), motion.ts (transitions) and gestures.ts (swipes)
  components/mobile/   the phone layout: shell, bar, menu sheet, drawer, selection bar
  components/library/  "Your charts"
  platform/     where the platforms differ: the browser's stand-ins for the desktop app (file
                access, IndexedDB, the web library) and the desktop's library over the Charts folder
```

- **Two layouts, one editor.** `store/layout.svelte.ts` picks the phone layout on touch screens with a
  phone-sized short side (`?mobile=1` / `?mobile=0` force it); App.svelte shows `MobileApp` or the
  desktop workbench. Both have the same features from the same stores, canvases and panels - the
  timeline or the highway (`display.mainView`), tap-along recording (`store/recording.svelte.ts`),
  practice tools (`store/practice.svelte.ts`), "Your charts" - and only arrange them differently.
  Touch gestures live in `views/touch.ts`; a mouse never reaches the code that differs. A new
  feature goes in both.
- **Layouts keep their own state.** `mobile.*` (store/mobile.svelte.ts) is read and written only in
  `components/mobile/`. Shared code that needs a settings tab shown calls `ui.revealTab(tab)`:
  the desktop switches its tab bar, the phone opens its drawer. The settings tabs are listed once, in
  `components/panels/tabs.ts`.
- **State lives in the store it's about**, not in one catch-all: what is being edited in `editing`,
  the playhead in `transport`, how things are shown in `display`, the chart's files in `session`,
  the shared interface in `ui`, anything derived only from the chart on `doc`. A new field goes in
  the store it belongs to; a new store when none fits. Settings kept between visits use
  `store/remembered.ts`.
- **Motion comes from `components/motion.ts`**: one set of timings, and transitions used as separate
  `in:` and `out:` directives (`in:panel={...} out:panel={...}`) so each knows its direction - things
  leave faster than they arrive, and a leaving element ignores the pointer. Reduced motion turns
  slides into a short fade. Canvases never animate: what's drawn follows the finger exactly.
- **Touch gestures are recognised in plain classes** - `views/touch.ts` for the canvases (taps,
  pinches, long presses, two-finger taps, `dragStartsAfterPixels` for any press that drags what it
  pressed; a canvas takes `Fingers` for the pinch and two-finger undo every canvas has, and
  `restingFinger` for a long press on what it pressed) and `views/swipe.ts` for panels - and wired up by `components/gestures.ts`'s actions
  (`use:dismissable`, `use:edgeSwipe`). Touch only; every gesture also has a button. The browser
  keeps any drag `touch-action` allows for scrolling, and combines `touch-action` only up to the
  nearest scrolling element: a scrolling panel that swipes sideways needs `touch-action: pan-y` on
  that scrolling element itself, or the swipe never arrives.
- **Commands and their keys come from `store/commands.ts`**, one table of File / Edit / View /
  Playback menus. The desktop's `MenuBar` and the phone's menu sheet draw it, the Help tab lists it,
  and `store/keyboard.ts` matches key presses against each command's `keys` text ("Ctrl S", "Delete /
  Backspace"). Add a command there rather than wiring a button or a key to an action by hand; a
  button outside the menus spreads `commandButton(id)` and keeps its own (shorter) text.
- **"Your charts"** (`store/library.svelte.ts`) reads a `LibrarySource`: the browser's storage on the
  web (`platform/library-web.ts`, saving as you go), the game's Charts folder in the desktop app
  (`platform/library-desktop.ts`, saving with Ctrl S). The main process only reads, copies or bins
  folders inside the Charts folder; `BASALT_CHARTS_FOLDER` points it at another folder, to try it
  without touching real charts.
- **The web build** (`npm run build:web`, `vite.config.web.ts`) is the same renderer with
  `platform/web.ts` standing in for the preload, published to GitHub Pages (the `gh-pages` branch)
  as several copies: the live site at the root, changed only by publishing a release
  (`web-release.yml`); `/prerelease/` from every push to `main`; `/pr-<number>/` from each pull
  request, taken down when it closes. `.github/publish-pages.sh` replaces one copy and leaves the
  rest. Test copies say so in the top bar and their home-screen name (`BASALT_WEB_CHANNEL`,
  `components/BuildBadge.svelte`). They share the live site's browser storage - same origin - so
  nothing a copy stores there may be something an older or newer copy can't read.

- **The renderer never touches Node or the file system directly** - only `window.editor`, through
  `store/files.ts`. It stays a plain web app: `npm run dev:renderer` serves it in a browser, with
  everything but the dialogs working.
- **`model/`, `io/` and `audio/` import nothing from Svelte or Electron**, so Vitest covers them
  without a DOM. Logic worth testing goes there; components stay thin. Vitest compiles runes too,
  so `store/` can be tested - as long as importing a module creates nothing (playback makes its
  `<audio>` element on first use, not at import).
- **A component's script is wiring.** If it grows past reading state and calling functions, the
  logic goes in a `.ts` beside it: chart edits in `model/edits.ts`, what a press on a canvas means in
  `views/*/interaction.ts` (it returns a decision; the component applies it), commands and their
  keys in `store/commands.ts`.
- **The chart's text is the source of truth.** An edit mutates the parsed chart (deep `$state`)
  inside `doc.change(keys, mutate)`, which writes only those keys back with `Jsonc.set` - comments,
  key order and recorded clips elsewhere survive. Undo keeps whole texts, not objects. A live drag
  mutates directly and calls `doc.commit(before, keys)` on release.
- **An object pushed into a `$state` array comes back as a different (proxy) object.** To find it
  again after sorting, read it back from the array (`events.at(-1)`) and keep that, not the object
  you pushed - `indexOf(original)` is -1.
- **Canvases stay plain TypeScript.** A component owns the `<canvas>` and an `$effect` calls a pure
  `draw*` function; whatever state the draw reads is tracked, so it redraws when that changes.
  Interaction state that must redraw (a selection box) is `$state`; drag bookkeeping is a plain
  variable.
- **Two themes, Basalt (dark) and Ash (light)**, picked by `<html data-theme>` from
  `store/appearance.svelte.ts`. Every colour is a variable in `app.css`, defined for both - no hex in
  components or draw code. Tints are `color-mix(...)` in CSS and `alpha(t.x, n)` on a canvas; `--wash`
  is what hover and band tints mix from (white on dark, black on light). Canvases read the variables
  through `theme(appearance.scheme)`, which makes the draw redraw when the theme changes.
- **Inputs are one-way** (`value={...}` plus `onchange`), so each committed field is one undo step.

## The chart format and the game's numbers

The format belongs to the mod. `npm run sync` copies `docs/chart.schema.json` from
`../Basalt` into `schema/` and regenerates `model/chart.gen.ts`, and copies the game's
measured structure sizes (`UserData/Basalt/SelfTest/structures.json`, from the mod's `=measure`
self-test) into `data/`. Both copies are committed so the editor builds without the mod or the game.
Change the format in the mod first, then sync. Match the mod's behaviour, not the old editor's:
`ChartRunner` and `ChartLoader` are the reference.

Looks (`shaders` cues) work the same way. `npm run sync` also copies the BossBattles Stage pack's
manifest from `../RumbleBossBattlesShaders` into `data/packs/`; its `group` and `colour` fields lay
out the Looks tab. `model/looks.ts` ports the mod's `LookTimeline` (how cues fade into one another)
and the Stage shader's maths for the timeline's preview strip - change it when they change, and keep
the tests that check Stage against a transcription of the retired BossBattles Night shader.

## Releases

- **Branches:** short-lived branches and pull requests into `main`; `main` is always releasable but
  not yet released. Each pull request gets a preview to try on a phone, `main` is the prerelease,
  and a tag marks a release. Make a `release/x.y` branch from a tag only to fix a release while
  `main` holds unreleased work.
- `ci.yml` runs check, tests and both builds on every push and pull request, then publishes the
  test copy of the website (above); only its publish job can write to the repository. Pushing a
  `v*` tag runs `release.yml`: a matrix (`windows-latest`, `macos-latest`, `ubuntu-latest`) builds
  and publishes to a draft release; publish the draft by hand, which also publishes the live
  website from that tag (`web-release.yml`; run it by hand with a tag for a website-only fix). Keep
  the tag and `package.json`'s version in step.
- Don't commit build output (`out/`, `dist/`); release assets aren't subject to git's 100 MB limit.
- `electron-builder.yml`'s `publish` names the GitHub owner and repo the updater reads - it must
  match where releases actually go.
- **Signing:** Windows builds ship unsigned for now (users see a SmartScreen warning they can click
  through); unsigned macOS builds are blocked by Gatekeeper and can't auto-update; Linux AppImages
  need no signing. Signing costs money (Azure Trusted Signing ~$10/month, Apple Developer $99/year).
- The app icons (`build/icon.png`, `build/icon.ico`, the favicon) are drawn from
  `src/renderer/src/assets/logo*.svg` by `npm run icons`; rerun it after changing the mark, and commit
  the outputs.
