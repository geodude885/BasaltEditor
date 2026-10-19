# Working on the Boss Battles chart editor

A desktop editor for RUMBLE Boss Battles charts (`chart.json` plus song, cover and clips, packaged
as `.bbchart`). It replaced the single-file HTML editor that used to ship inside the mod; the mod no
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
src/main/       Electron main: window, dialogs, file access (only folders the user opened)
src/preload/    exposes src/shared/api.ts to the page as window.editor
src/shared/     the API between them - types and IPC channel names
src/renderer/src/
  model/        chart types, JSONC, tempo, validation (problems), edits, looks - pure TypeScript
  io/           zip, and sorting opened files into a chart and its song, cover and clips
  audio/        waveform peaks
  store/        document (text, chart, undo), editor (UI state), actions, files, playback, keyboard
  views/lane/   lane canvas: geometry, draw, interaction (what a press hits), the component
  views/timeline/  timeline canvas: rows and markers, draw, interaction, the component
  components/   top bar, transport, inspector, the tab panels
```

- **The renderer never touches Node or the file system directly** - only `window.editor`, through
  `store/files.ts`. It stays a plain web app: `npm run dev:renderer` serves it in a browser, with
  everything but the dialogs working.
- **`model/`, `io/` and `audio/` import nothing from Svelte or Electron**, so Vitest covers them
  without a DOM. Logic worth testing goes there; components stay thin. Vitest compiles runes too,
  so `store/` can be tested - as long as importing a module creates nothing (playback makes its
  `<audio>` element on first use, not at import).
- **A component's script is wiring.** If it grows past reading state and calling functions, the
  logic goes in a `.ts` beside it: chart edits in `model/edits.ts`, what a press on a canvas means in
  `views/*/interaction.ts` (it returns a decision; the component applies it), shortcuts in
  `store/keyboard.ts` (one table, which the Help tab lists).
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
- **Inputs are one-way** (`value={...}` plus `onchange`), so each committed field is one undo step.

## The chart format and the game's numbers

The format belongs to the mod. `npm run sync` copies `docs/chart.schema.json` from
`../RumbleBossBattles` into `schema/` and regenerates `model/chart.gen.ts`, and copies the game's
measured structure sizes (`UserData/BossBattles/SelfTest/structures.json`, from the mod's `=measure`
self-test) into `data/`. Both copies are committed so the editor builds without the mod or the game.
Change the format in the mod first, then sync. Match the mod's behaviour, not the old editor's:
`ChartRunner` and `ChartLoader` are the reference (e.g. a phase's spot is placed at the phase's start
on the same timeline as events, so the latest by time wins).

Looks (`visuals` cues) work the same way. `npm run sync` also copies the BossBattles Stage pack's
manifest from `../RumbleBossBattlesShaders` into `data/packs/`; its `group` and `colour` fields lay
out the Looks tab. `model/looks.ts` ports the mod's `LookTimeline` (how cues fade into one another)
and the Stage shader's maths for the timeline's preview strip - change it when they change, and keep
the tests that check Stage at its defaults against a transcription of BossBattles Night.

## Releases

- `ci.yml` runs check, tests and build on every push. Pushing a `v*` tag runs `release.yml`: a
  matrix (`windows-latest`, `macos-latest`, `ubuntu-latest`) builds and publishes to a draft
  release; publish the draft by hand. Keep the tag and `package.json`'s version in step.
- Don't commit build output (`out/`, `dist/`); release assets aren't subject to git's 100 MB limit.
- `electron-builder.yml`'s `publish` names the GitHub owner and repo the updater reads - it must
  match where releases actually go.
- **Signing:** Windows builds ship unsigned for now (users see a SmartScreen warning they can click
  through); unsigned macOS builds are blocked by Gatekeeper and can't auto-update; Linux AppImages
  need no signing. Signing costs money (Azure Trusted Signing ~$10/month, Apple Developer $99/year).
- No app icon yet: electron-builder uses Electron's. Put a 512x512+ `build/icon.png` in to fix it.
