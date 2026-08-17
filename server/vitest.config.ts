import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // These tests are all pure-logic unit tests (round-robin scheduling,
    // pricing math, formation detection) that don't touch Postgres — there's
    // no test database wired up in this project yet. Anything that needs
    // Prisma should mock it rather than assume a live DB is available.
    globals: false,
  },
});
