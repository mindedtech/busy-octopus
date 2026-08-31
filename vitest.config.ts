/**
 * @file Configure the project test runner.
 */

import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    exclude: [...configDefaults.exclude, "test/extension/**"],
    include: ["**/*.test.ts"],
    restoreMocks: true,
  },
});
