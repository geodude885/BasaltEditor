// Draws the app icons from the Basalt mark, with Electron's own renderer so there's nothing to install.
//   build/icon.png             <- 1024 px, macOS grid (the tile inset in the canvas); electron-builder makes the .icns from it
//   build/icon.ico             <- Windows: 16-32 px frames from the small mark (wider gaps), 48-256 px from the full one
//   src/renderer/public/favicon.svg, icon.png  <- the browser tab in dev:renderer, and the Linux window icon
//   src/renderer/public/apple-touch-icon.png, icon-192.png, icon-512.png  <- the web build's home-screen icons
// usage: npm run icons (after changing src/renderer/src/assets/logo*.svg)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { app, BrowserWindow } from "electron";

const root = resolve(import.meta.dirname, "..");
const BASALT = "#1b1c1e", ASH = "#e7e3dc";

/** The mark's viewBox and paths, from one of the asset SVGs. */
function readMark(name) {
  const svg = readFileSync(resolve(root, "src/renderer/src/assets", name), "utf8");
  return { viewBox: /viewBox="([^"]+)"/.exec(svg)[1], paths: svg.match(/<path [^>]*\/>/g).join("") };
}

/**
 * The mark in ash on a rounded basalt tile. inset: canvas margin around the tile; mark: its share of
 * the tile; square: no rounding, for home screens, which round the corners themselves.
 */
function tile(mark, { inset, mark: share, keyline, square = false }) {
  const t = 1024 * (1 - 2 * inset), x = 1024 * inset, m = t * share, mx = 512 - m / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">`
    + `<rect x="${x}" y="${x}" width="${t}" height="${t}" rx="${square ? 0 : t * 0.225}" fill="${BASALT}"/>`
    + (keyline ? `<rect x="${x + 2}" y="${x + 2}" width="${t - 4}" height="${t - 4}" rx="${t * 0.225 - 2}" fill="none" stroke="#ffffff14" stroke-width="4"/>` : "")
    + `<svg x="${mx}" y="${mx}" width="${m}" height="${m}" viewBox="${mark.viewBox}" fill="${ASH}">${mark.paths}</svg></svg>\n`;
}

/** An .ico holding PNG frames (Windows Vista and later read them). */
function ico(frames) {
  const header = Buffer.alloc(6 + 16 * frames.length);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  frames.forEach(({ size, png }, i) => {
    const at = 6 + 16 * i;
    header.writeUInt8(size % 256, at); header.writeUInt8(size % 256, at + 1);
    header.writeUInt16LE(1, at + 4); header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(png.length, at + 8); header.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...frames.map(f => f.png)]);
}

function write(path, data) {
  const target = resolve(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, data);
  console.log(`  ${path}`);
}

app.commandLine.appendSwitch("force-device-scale-factor", "1");
app.disableHardwareAcceleration();
let window;
const newWindow = () => new BrowserWindow({ show: false, width: 1024, height: 1024, frame: false, transparent: true, backgroundColor: "#00000000", webPreferences: { offscreen: true } });

/** One SVG drawn at size x size pixels, as PNG bytes. */
async function render(svg, size) {
  const page = `<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`;
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page)}`);
  await window.webContents.executeJavaScript("new Promise(done => setTimeout(done, 100))");
  return (await window.webContents.capturePage({ x: 0, y: 0, width: size, height: size })).toPNG();
}

async function main() {
  window = newWindow();
  const full = readMark("logo.svg"), small = readMark("logo-small.svg");
  // Windows and the window icon fill the frame; macOS wants the tile inset with a keyline.
  const filled = mark => tile(mark, { inset: 0.03, mark: 0.7, keyline: false });
  const frames = [];
  for (const size of [16, 24, 32]) frames.push({ size, png: await render(filled(small), size) });
  for (const size of [48, 64, 128, 256]) frames.push({ size, png: await render(filled(full), size) });
  write("build/icon.png", await render(tile(full, { inset: 100 / 1024, mark: 0.68, keyline: true }), 1024));
  write("build/icon.ico", ico(frames));
  write("src/renderer/public/favicon.svg", filled(small));
  write("src/renderer/public/icon.png", frames.at(-1).png);
  // Home screens: full-bleed squares (iOS fills transparency with black), the mark inside the safe zone
  // Android's masks keep.
  const home = tile(full, { inset: 0, mark: 0.6, keyline: false, square: true });
  write("src/renderer/public/apple-touch-icon.png", await render(home, 180));
  write("src/renderer/public/icon-192.png", await render(home, 192));
  write("src/renderer/public/icon-512.png", await render(home, 512));
}

// Not a top-level await: Electron holds back "ready" until the main module has finished loading.
app.whenReady().then(main).catch(e => { console.error(e); process.exitCode = 1; }).finally(() => app.quit());
