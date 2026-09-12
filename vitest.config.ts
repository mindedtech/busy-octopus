/**
 * @file Configure the project test runner.
 */

export default {
  test: {
    environment: "node",
    include: ["**/*.spec.test.ts"],
    maxWorkers: 4,
    restoreMocks: true,
  },
};
