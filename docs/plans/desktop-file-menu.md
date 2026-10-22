# Plan: desktop File / Edit / View menus and a chart browser

Not built yet. The web version got "Your charts" (a library kept in the browser) and a shared command
table first; this note is how the desktop app picks both up without reworking them.

## Menus from the command table

`src/renderer/src/store/commands.ts` already lists every menu command, grouped into File, Edit and
View, with labels, the keys that do them, and when each applies (`enabled`, `shown`, `checked`). The
phone menu (`components/mobile/MenuSheet.svelte`) is drawn from it. For the desktop:

- **In-page menu bar** (simplest): a `MenuBar.svelte` that draws `menus()` as File / Edit / View
  drop-downs in place of `TopBar`'s row of buttons, keeping the chart name, problems chip and theme on
  the right. Keyboard: Alt opens it, arrows move, Escape closes.
- **Native menu** (feels most like a desktop app): the main process builds `Menu.buildFromTemplate`
  from a plain copy of the table the page sends over a new `editor:menus` channel, and sends the chosen
  command's `id` back (`editor:command`) for the page to `run()`. The page re-sends the table when
  `enabled`/`checked`/labels change. Accelerators come from `keys`.
- Either way, **one source for shortcuts**: `keys` duplicates what `store/keyboard.ts`'s `SHORTCUTS`
  matches. Fold them together - each shortcut naming the command `id` it runs - so the Help tab, the
  menus and the keys can't drift apart.
- Commands one platform can't do say so with `shown` (Open folder is hidden on phones via
  `platform.canOpenFolders`). Places can add their own groups with `addToMenu` - the desktop might add
  View > Lane / Timeline layouts, or Window > Developer tools.

## A chart browser over the Charts folder

`store/library.svelte.ts` keeps "Your charts" through a `LibrarySource` (`list`, `load`, `save`,
`remove`); the web one is `platform/library-web.ts` (IndexedDB). The desktop app can implement the
same interface over `UserData/Basalt/Charts`, so the same `components/library/Library.svelte` cards
work there:

- `list()`: a new IPC call that reads each chart folder's `chart.json` (name, author, difficulty, the
  projectile count, `music.file`) and its cover's bytes, plus the folder's modified time. Packages
  (`.bbchart`) in the folder can be listed too, read from the zip.
- `load(id)`: `id` is the folder path; it's what Open folder already does (`editor:open-folder`),
  without the dialog - and the folder then counts as opened, so Save and the game's live reload work.
- `save()`: on the desktop, saving stays explicit (Ctrl S into the folder), so the source's `save` can
  be a no-op and the library's autosave left off; `remove` could move a folder to the bin
  (`shell.trashItem`), and duplicate copy it.
- Before switching charts with unsaved changes, ask: save, discard, or cancel. The web doesn't need
  this because it saves as you go.
- Open recent: the last few folders, kept by the main process.
