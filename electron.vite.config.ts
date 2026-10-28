import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "electron-vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { noDevServerInCsp } from "./vite.plugins";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));

export default defineConfig({
  main: {},
  preload: {
    // Sandboxed preloads must be CommonJS.
    build: { rollupOptions: { output: { format: "cjs", entryFileNames: "[name].cjs" } } },
  },
  renderer: {
    resolve: { alias: { $data: resolve("data") } },
    define: { __APP_VERSION__: JSON.stringify(version), __BUILD_LABEL__: JSON.stringify("") },
    plugins: [svelte(), noDevServerInCsp()],
  },
});
