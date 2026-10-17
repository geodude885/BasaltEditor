import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { $data: resolve("data") } },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
