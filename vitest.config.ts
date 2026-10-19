import { resolve } from "node:path";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // The Svelte plugin compiles runes in store/*.svelte.ts, so the stores can be tested too.
  plugins: [svelte()],
  resolve: { alias: { $data: resolve("data") } },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
