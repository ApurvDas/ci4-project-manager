import { defineConfig } from "vitest/config";

// Unit tests cover the pure logic only (scaling, search) — no DOM, no DB — so
// the node environment is all we need. Component/e2e coverage lives elsewhere.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
