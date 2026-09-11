/**
 * @file Run release lifecycle tests with a virtual display on headless Linux.
 */

import { spawn } from "node:child_process";
import { env, execPath, platform } from "node:process";
import { fileURLToPath } from "node:url";

const runCommand = async ({
  argumentList,
  command,
  environment,
}: {
  argumentList: string[];
  command: string;
  environment: NodeJS.ProcessEnv;
}): Promise<void> => {
  const { promise, reject, resolve } = Promise.withResolvers<void>();
  const child = spawn(command, argumentList, {
    env: environment,
    stdio: "inherit",
  });

  child.once("error", reject);
  child.once("exit", (code, signal) => {
    if (code === 0) {
      resolve();
      return;
    }

    reject(
      new Error(
        `${command} exited with ${code === null ? `signal ${signal}` : `code ${code}`}.`,
      ),
    );
  });

  await promise;
};

if (
  platform === "linux" &&
  env.DISPLAY === undefined &&
  env.BUSY_OCTOPUS_TEST_DISPLAY !== "1"
) {
  await runCommand({
    argumentList: [
      "--auto-servernum",
      execPath,
      "--experimental-strip-types",
      fileURLToPath(import.meta.url),
    ],
    command: "xvfb-run",
    environment: { ...env, BUSY_OCTOPUS_TEST_DISPLAY: "1" },
  });
} else {
  await runCommand({
    argumentList: ["node_modules/vitest/vitest.mjs", "run", "test/release"],
    command: execPath,
    environment: env,
  });
}
