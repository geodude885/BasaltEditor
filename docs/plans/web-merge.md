# Plan: bringing the desktop layout level with the phone layout, and merging `web`

The one working note for finishing the `web` branch. It replaces `web-branch-status.md` and
`desktop-file-menu.md`. **Delete it in the last step, before merging.**

## Where things stand (2026-10-23)

- `web` is 18 commits ahead of `main`; `main` hasn't moved since, so the merge is conflict-free.
  `npm run check` is clean and all 97 tests pass. Draft PR #2 (`web` → `main`) is open; #1 is closed.
- Live at https://geodude885.github.io/BasaltEditor/ from the `gh-pages` branch, built by `web.yml`.
- **Not yet run in the Electron app since the branch started.**
- Already shared by both layouts: the song picker, songs replacing properly, media types, MP3-in-WAV
  waveforms, theme colours on canvases, icons, fixed-width clocks, the batch inspector, the
  multi-select toggle and touch gestures on the timeline (`views/touch.ts`).

## What the phone layout has and the desktop layout doesn't

| Phone layout | Lives in | Desktop today |
|---|---|---|
| Highway editor (works with a mouse already: click, drag, wheel scrubs, Ctrl+wheel stretches) | `views/highway/`, `components/mobile/HighwayScreen.svelte` | none |
| Tap-along recording, Add/Replace, tap timing | `store/recording.svelte.ts`, `model/takes.ts` | none (pads are touch-only; no keys) |
| Practice tools: A-B loop, back a bar / 5 s, Last play, pre-roll, minimap | `store/practice.ts`, `store/mobile.svelte.ts`, `Minimap.svelte` | none. The loop also only goes round while `MobileApp` is mounted, and the timeline doesn't draw it |
| Select mode; select bar / loop / to end / all | `editor.selectMode`, `store/actions.ts`, `SelectionBar.svelte` | the timeline honours `selectMode`, but nothing on the desktop turns it on; there's no way to select a whole section |
| Menus drawn from `store/commands.ts` | `MenuSheet.svelte` | `TopBar.svelte` wires its own buttons and checks the platform by hand, which CLAUDE.md says not to do |
| "Your charts" library | `store/library.svelte.ts`, `platform/library-web.ts` | web only. The desktop has no chart browser and no recent charts |

And the Help tab says nothing about touch, the highway or recording on either layout.

## Decisions

These are recommendations; change them before starting the phase they affect.

1. **The desktop menu bar is drawn in the page, not built as a native Electron menu.** The web build's
   desktop layout (browsers on a laptop) needs it too, it follows the theme, and one implementation
   serves both. The native menu can come later from the same table.
2. **The highway goes into the time pane, behind a Timeline | Highway switch**, with the lane staying
   on the left as it does on phones. The practice controls sit in a strip beside it, the same
   component the phone layout uses.
3. **On a keyboard, recording uses one key per column** (`D F Space J K`, guitar-game style, or
   `1`-`5`; pick one) while Rec is armed. The pads stay clickable. Space can't be both a column and
   play/pause, so if it's a column, Enter plays while recording is armed.
4. **Practice and highway state move out of `store/mobile.svelte.ts`** into a shared
   `store/practice.svelte.ts`. `mobile` keeps only the phone's own state (the menu sheet, the drawer
   and which editor fills the screen).
5. **On the desktop, the library lists the Charts folder through a `LibrarySource`** (the design is
   below). Saving stays explicit (Ctrl S); there's no autosave.
6. **After the merge, `main` deploys the website.** `web.yml` builds on pushes to `main`, and `ci.yml`
   also runs `build:web` on pull requests. The `web` branch is retired.

## Phases

Each phase ends with `npm run check` and `npm test` green, and one commit (or a few). Phases 1-3 come
first, in order, because the rest builds on them. 4 and 5 are independent of each other: they touch
different files (4: views and components; 5: main, preload, `shared/api.ts`, library), so they can run
in parallel sessions.

### 0. Desktop smoke test - done 2026-10-23, no regressions

Ran in Electron with `npm run dev` and as a built app, against a copy of a real chart. Native dialogs
were scripted through the main process's inspector. All of these worked: Open folder (song, waveform,
clips, looks), P to add, Undo, Ctrl S into the folder, Package, Open files with a `.bbchart`, Change
song (the song-only picker), box-select, and setting a field on 3 projectiles at once, the dark theme
and playing. In the built app (`file://`), there were no console errors, CSP violations or failed loads.
The web build's desktop layout (`?mobile=0`) and "Your charts" load cleanly.

Problems found, all older than this branch:

- **The desktop page scrolls as a whole** when a tab's panel is long. `#app` has no height, so
  `.app`'s `height: 100%` resolves to auto. Give `#app` `height: 100%` and check the panes scroll on
  their own. Small; do it in phase 3, which reworks the top of the layout.
- **Packages take every file read beside `chart.json`**, including `chart.json.bak` and `.broken`
  files. `savePackage` should keep only the chart's song and cover, its clips, and the files the chart
  names. Small; fix it in phase 6.
- **Opening another chart throws away unsaved changes without asking.** Phase 5's Save / Discard /
  Cancel prompt covers it.
- **Editing any event rewrites the whole `events` key**, which drops comments inside it and expands
  its formatting. This is by design (`doc.change` writes back whole keys). Leave it; mention it in
  Help.
- The desktop build also ships the web's home-screen icons and manifest in `out/renderer`. They're
  harmless; ignore them.

### 1. Shared practice state (no visible change on phones)

- New `store/practice.svelte.ts`: `loop`, `loopStart`, `playFrom`, `preroll`, `highwayPps`, plus the
  functions now in `store/practice.ts` (merge the two files). Update `commands.ts`, `Highway.svelte`,
  `Minimap.svelte`, `HighwayScreen.svelte`, `SelectionBar.svelte` and `recording`'s `replaceSpan`.
- Move the `keepLooping` effect from `MobileApp.svelte` up to `App.svelte`, so the loop goes round in
  either layout.
- Make `playOrPause` the one way to play: the desktop Transport and the Space shortcut both call it,
  so Last play and pre-roll work everywhere.
- The timeline draws the loop (shaded, as the highway and minimap do), and the A point once it's set.
- Tests: `model/practice.test.ts` already covers the maths. Add a store test for loop set / clear /
  keepLooping if it can be done without a DOM.

### 2. One table for commands and shortcuts

- Fold `store/keyboard.ts`'s `SHORTCUTS` into `store/commands.ts`: each command carries its key
  matcher, and `keys` is what's shown. `handleShortcut` finds the command; the Help tab, the menus and
  the keys read from the same place and can't drift. Shortcuts that aren't menu commands (arrow
  nudges) stay as commands with `shown: () => false` in menus, or in a small "keys only" group.
- New commands, so every phone-only button has a command:
  - **Playback:** loop A/B/off, back a bar, back 5 s, Last play, pre-roll (checked), beat click
    (checked).
  - **Recording:** arm (checked), Add/Replace.
  - **View:** Timeline / Highway (radio), stretch the highway.
  - **Edit:** Select mode (checked) and the select-section commands, which already exist.
  - **Keys:** Ctrl A selects all, `L` sets loop points, `,` goes back a bar, Backspace jumps to Last
    play. These are proposals; check they don't clash with the existing keys.
- Add a "Playback" menu (or put these under View) to the table.
- Tests: a test that every command `keys` string has a matcher and no two commands match the same
  key event.

### 3. Desktop menu bar

- New `components/MenuBar.svelte`: File / Edit / View / Playback drop-downs drawn from `menus()` and
  `visibleGroups`, with ticks for `checked`, greyed-out `enabled`, and the `keys` on the right. Keyboard:
  Alt (or F10) focuses it, arrows move, Enter runs, Escape closes. Clicking outside closes it.
- `TopBar.svelte` keeps the brand, chart name, menu bar, Undo/Redo, the problems chip and the theme.
  The hand-wired file buttons go, and with them TopBar's direct import of `platform/web`
  (`platform.canOpenFolders` in `commands.ts` already covers it). Keep Save as a visible primary
  button, as most people expect.
- The phone's `MenuSheet` draws the new Playback menu the same way it draws File and Edit. Its
  hand-built "Playing" section shrinks to the sliders: speed, volume and tap timing.

### 4. Highway, recording and practice on the desktop

- Pull the controls column out of `HighwayScreen.svelte` into `components/PracticeControls.svelte`
  (rewind, Last play, loop, pre-roll, minimap, Rec and its mode). Both layouts use it; `Minimap`
  moves out of `components/mobile/`.
- Desktop time pane: a Timeline | Highway switch, driven by shared view state. If both layouts should
  remember the choice, that state moves to `editor`. Highway shows `Highway` + `PracticeControls`,
  with the panels under it as now.
- Recording keys from decision 3: a key table in `store/recording.svelte.ts` (or in commands, active
  only while armed), with `hit(column)` as the pads use. Pads show on the desktop too, clickable, and
  light up on key presses.
- Tap timing gets a slider in the Transport (or a Playback settings popover).
- Update `views/highway/` and `HighwayScreen` comments, which call it "the phone layout's" highway.

### 5. Your charts on the desktop

Built on `LibrarySource` (`list`, `load`, `save`, `remove`), so `Library.svelte`'s cards work as they
are.

- **IPC** (`shared/api.ts`, `preload`, `main`): `listCharts()` reads each folder under
  `UserData/Basalt/Charts`: `chart.json`'s name, author, difficulty, projectile count and `music.file`,
  plus the cover's bytes and the folder's modified time. `.bbchart` packages can be listed too, read
  from the zip. `trashChart(folder)` uses `shell.trashItem`; `duplicateChart(folder)` copies the
  folder. All of them keep to the Charts folder, the way `saveChart` keeps to opened folders.
- **`platform/library-desktop.ts`**: `load(id)` is Open folder without the dialog, so the folder counts
  as opened and Save and the game's live reload work. `save` does nothing (saving stays Ctrl S), and
  the library's autosave effect is switched off by an option to `library.start`.
- **Unsaved changes:** before switching charts (library, Open, New) with `doc.dirty`, ask Save,
  Discard or Cancel. The web doesn't need this, because it saves as you go.
- **Open recent:** the last few folders, kept by the main process, as a File submenu (or a group).
- `library.available` turns on in the desktop app; `main.ts` starts the right source per platform.
- Tests: summarising a chart folder (pure, in `io/`), and the zip listing for packages.

### 6. Open issues from the phone work

- **Pre-roll feels off on phones.** Probably the silent unlock in `playback.ts` racing `tick()`'s real
  start. Look at it on an iPhone once phase 1 has moved pre-roll; fix or note it as known.
- **MP3 inside a WAV wrapper** plays and draws here but may not load in the game. Check with the mod
  (`ChartLoader`). If the game can't load them, unwrap with `audio/riff.ts`'s `mp3InsideWav` when
  packaging and saving, renaming to `.mp3`, and warn in Problems.

### 7. Cleanup before merging

- [ ] Delete this file.
- [ ] `CLAUDE.md`:
  - Shape: `views/highway/` is no longer "the phone layout's"; `components/mobile/` no longer holds the
    highway screen.
  - "Two layouts" says the highway and recording are in both.
  - Menus: describe `MenuBar` and the command/shortcut table; drop the `docs/plans/...` pointer.
  - Web build: `web.yml` deploys from `main`; drop "trial".
  - `store/` line: add practice, recording, library, layout, commands.
- [ ] `README.md`: replace the line "Now includes webapp deployment & mobile support." (added
  in c586ff6, with a trailing space) with a short paragraph linking the live site and saying how to
  add it to a phone's home screen.
- [ ] `.github/workflows/web.yml`: trigger on `push: branches: [main]` and `workflow_dispatch`. Drop
  `pull_request` and the `if:` on the `web` branch, and the word "trial". `ci.yml`: add
  `npm run build:web`.
- [ ] Comments that say "later", "for now" or "the web only" go stale once the work lands:
  - `store/commands.ts` (header: "a desktop menu bar later")
  - `store/library.svelte.ts` (the header, and `available`: "the web, for now")
  - `store/mobile.svelte.ts` (header)
  - `store/practice.ts` (header: "The phone layout's practice tools")
  - `views/highway/Highway.svelte`, `HighwayScreen.svelte`, `MenuSheet.svelte` ("what the desktop's
    top bar and transport hold")
- [ ] `MobileBar.svelte`'s styles set things twice: `.name` `max-width` (18ch, then 14ch) and two
  `.clock small` rules. Merge them.
- [ ] `Transport.svelte`'s touch-only row duplicates `SelectionBar`. Keep it, for tablets in the
  desktop layout, or replace it with `SelectionBar` there.
- [ ] Help tab: touch gestures (tap, hold, pinch), the highway, recording and practice keys. Keys come
  from the command table after phase 2.
- [ ] `package.json` version: 0.2.0 → 0.3.0, with a `v0.3.0` tag after merging.
- [ ] PR #2: retitle it (it's "CI build: Web app draft") and write a real description. Merge with a
  merge commit, not a squash: the 18 commits are well described and worth keeping. Then delete the
  `web` branch; `gh-pages` stays.

### 8. Verification

- `npm run check`, `npm test`, `npm run build`, `npm run build:web`.
- Electron (`npm run dev`), then a packaged build (`npm run dist:win`) on Windows: menus, the library
  over the Charts folder, the highway with a mouse, recording with keys, the loop, both themes.
- Phone layout (`?mobile=1` in a browser, then a real phone from the deployed site): nothing lost from
  today. That means the menu sheet, the drawer, recording with pads, practice tools, the library and
  Select mode.
