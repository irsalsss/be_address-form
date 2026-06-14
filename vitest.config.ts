import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
    // DB-backed tests share one Postgres table; run files sequentially so a
    // per-file `beforeEach` truncate can't race inserts in another file.
    fileParallelism: false,
  },
});
