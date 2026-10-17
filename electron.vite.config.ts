import { resolve } from "node:path";
import { defineConfig } from "electron-vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  main: {},
  preload: {
    // Sandboxed preloads must be CommonJS.
    build: { rollupOptions: { output: { format: "cjs", entryFileNames: "[name].cjs" } } },
  },
  renderer: {
    resolve: { alias: { $data: resolve("data") } },
    plugins: [svelte()],
  },
});
