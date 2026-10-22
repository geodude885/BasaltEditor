// The editor as a plain website, for phones and browsers: the same renderer the desktop app loads,
// with platform/web.ts standing in for the preload. `npm run build:web` writes it to out/web; any
// static host serves it (relative paths, so a GitHub Pages sub-path works).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));

export default defineConfig({
  root: resolve("src/renderer"),
  base: "./",
  resolve: { alias: { $data: resolve("data") } },
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [svelte({ configFile: resolve("svelte.config.js") })],
  build: { outDir: resolve("out/web"), emptyOutDir: true },
});
