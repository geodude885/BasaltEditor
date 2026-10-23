# Status: the `web` branch (phone / web version)

Where the trial web build stands, for whoever picks it up next. Delete this file before merging.

## What's here

All on `web`, nothing on `main`. Draft PR #1 (`web` → `main`) exists only so CI runs; don't merge it
without deciding to.

- Web build: `npm run dev:web` (served on the network, for trying on a phone) and `npm run build:web`
  → `out/web`. `platform/web.ts` stands in for the preload. Live at
  https://geodude885.github.io/BasaltEditor/ from the `gh-pages` branch.
- Phone layout (`components/mobile/`, `store/layout.svelte.ts`; `?mobile=1` forces it on a desktop
  browser): fixed landscape-first shell, menu sheet drawn from `store/commands.ts`, settings drawer,
  floating inspector, selection bar with Select mode and Bar / Loop / To end / All.
- Highway editor and tap-along recording (`views/highway/`, `store/recording.svelte.ts`), practice
  tools (`store/practice.ts`: A-B loop, rewind, Last play, pre-roll, minimap).
- "Your charts" library in IndexedDB (`store/library.svelte.ts`, `platform/library-web.ts`).
- Batch editing of several projectiles (`components/BatchInspector.svelte`, `model/batch.ts`).
- Also touches the desktop app (fine to keep): song picker, songs replacing properly, media types
  for songs, MP3-in-WAV waveforms (`audio/riff.ts`), theme colours on canvases, icons, fixed-width
  clocks, multi-projectile editing.

## CI and deploys

`web.yml` checks, tests, builds the web version and force-pushes it to `gh-pages`. Pushes to `web`
haven't been starting workflows, so it also runs on pull requests: close and reopen PR #1 to run CI
and redeploy. Failing steps are reported as annotations (readable through the checks API).

## Open

- **Pre-roll** still feels off on a phone - not looked into yet.
- **MP3s inside a WAV wrapper** (RIFF/WAVE, format 0x55, often named .mp3) now play and show a
  waveform here, but may not load in the game. Option: unwrap them when packaging.
- **Desktop menus and chart browser**: planned in `desktop-file-menu.md`, not built.
- Not tried in the Electron app since these changes - run `npm run dev` and check the desktop layout.
