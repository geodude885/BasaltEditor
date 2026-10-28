// The editor as a plain website, for phones and browsers: the same renderer the desktop app loads,
// with platform/web.ts standing in for the preload. `npm run build:web` writes it to out/web; any
// static host serves it (relative paths, so a GitHub Pages sub-path works).
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { noDevServerInCsp } from "./vite.plugins";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));

/**
 * Which copy of the website this is, set by ci.yml: empty for the live site (a release), else what
 * the page shows so a test copy can't be mistaken for it - "prerelease" (main) or "PR 12" (a pull
 * request's preview) - with the commit it was built from.
 */
const channel = process.env.BASALT_WEB_CHANNEL ?? "";
const commit = (process.env.BASALT_WEB_COMMIT ?? "").slice(0, 7);
const label = channel ? [channel, commit].filter(Boolean).join(" · ") : "";

/** A test copy is named apart from the live site: in the tab, and on a home screen it's added to. */
function nameTheCopy(): Plugin {
  return {
    name: "name-the-copy",
    apply: "build",
    transformIndexHtml: html => !channel ? html : html
      .replace(/<title>([^<]*)<\/title>/, `<title>$1 (${channel})</title>`)
      .replace(/(name="apple-mobile-web-app-title" content=")([^"]*)"/, `$1$2 (${channel})"`),
    closeBundle() {
      if (!channel) return;
      const file = resolve("out/web/manifest.webmanifest"), manifest = JSON.parse(readFileSync(file, "utf8"));
      manifest.name = `${manifest.name} (${channel})`;
      manifest.short_name = `${manifest.short_name} (${channel})`;
      writeFileSync(file, JSON.stringify(manifest, null, 2));
    },
  };
}

export default defineConfig({
  root: resolve("src/renderer"),
  base: "./",
  resolve: { alias: { $data: resolve("data") } },
  define: { __APP_VERSION__: JSON.stringify(version), __BUILD_LABEL__: JSON.stringify(label) },
  plugins: [svelte({ configFile: resolve("svelte.config.js") }), noDevServerInCsp(), nameTheCopy()],
  build: { outDir: resolve("out/web"), emptyOutDir: true },
});
