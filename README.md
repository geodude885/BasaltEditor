# Basalt Editor

An editor for [RUMBLE](https://store.steampowered.com/app/890550/RUMBLE/) Basalt charts, on the
desktop and on the web.

Features:
* A timeline: the song's waveform under a beat grid, with projectiles, moves, phases and looks to
  add, select, move and edit - several at once.
* The lane seen from above, as it stands at the playhead.
* A highway: the lane's columns with time flowing down to a hit line, to chart by placing tiles - or
  by tapping along to the song (keys 1 to 5, or pads on a touch screen).
* Practice tools: an A-B loop, pre-roll, jumping back a bar or to where playing started.
* Your charts: open, duplicate or delete the charts in the game's `UserData/Basalt/Charts` folder.
  Open a chart folder, edit, and save - the game reloads it within a second.

Windows, macOS and Linux builds are on the Releases page; installed copies update themselves.

The same editor runs in a browser at https://geodude885.github.io/BasaltEditor/, laid out for phones
on a phone. Add it to your home screen to open it full screen; it keeps your charts in the browser.

## Developing

Needs Node 24.

```sh
npm install
npm run dev            # the app, with hot reload
npm run dev:renderer   # just the page, in a browser
npm run dev:web        # the web build, served on your network so a phone can open it
npm run build:web      # the web build into out/web (any static host serves it)
npm test               # Vitest: model, zip and file handling
npm run check          # svelte-check and TypeScript
npm run build          # into out/
npm run dist:win       # an installer into dist/ (also dist:mac, dist:linux)
npm run sync           # refresh the chart schema and structure sizes from the mod and the game
```

To try the desktop app's "Your charts" without touching your real charts, point it at a copy:
`BASALT_CHARTS_FOLDER=path/to/charts npm run dev`.

`CLAUDE.md` explains how the code is laid out and why.
