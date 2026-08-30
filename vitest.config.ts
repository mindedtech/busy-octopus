/**
 * @file Configure the project test runner.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    restoreMocks: true,
  },
});
