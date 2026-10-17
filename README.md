# Boss Battles Chart Editor

A desktop editor for [RUMBLE](https://store.steampowered.com/app/890550/RUMBLE/) Boss Battles charts:

Features:
* A scrollable beat grid, you can add, edit and select projectiles and moves to happen at different times.
* Song's waveform and ability to play th
    See the 'lane' from above and it's predicted state at the playhead. the song's waveform under a beat grid, projectiles, moves and phases on a
timeline. Open a chart folder from the game's `UserData/BossBattles/Charts`, edit, save the game
reloads it within a second.

Windows, macOS and Linux builds are on the Releases page; installed copies update themselves.

## Developing

Needs Node 24.

```sh
npm install
npm run dev            # the app, with hot reload
npm run dev:renderer   # just the page, in a browser (no file dialogs)
npm test               # Vitest: model, zip and file handling
npm run check          # svelte-check and TypeScript
npm run build          # into out/
npm run dist:win       # an installer into dist/ (also dist:mac, dist:linux)
npm run sync           # refresh the chart schema and structure sizes from the mod and the game
```

`CLAUDE.md` explains how the code is laid out and why.
