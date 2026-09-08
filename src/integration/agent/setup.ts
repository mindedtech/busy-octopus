/**
 * @file Install Busy Octopus hooks in workspace agent configuration.
 */

import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { resolveWorkspace } from "../../workspace/resolution.js";
import { type AgentProvider, selectAgentHookAdapter } from "./provider.js";

const MAXIMUM_AGENT_CONFIG_BYTE_COUNT = 1_048_576;

/**
 * Result of an agent configuration setup attempt.
 */
export type AgentSetupResult =
  | "cancelled"
  | "configured"
  | "unchanged"
  | "updated";

const readConfig = async (
  path: string,
): Promise<{ input: unknown; present: boolean; text: string | null }> => {
  try {
    const text = await readFile(path, "utf8");
    if (Buffer.byteLength(text) > MAXIMUM_AGENT_CONFIG_BYTE_COUNT) {
      throw new RangeError("Agent configuration exceeds the byte limit.");
    }

    return { input: JSON.parse(text), present: true, text };
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return { input: {}, present: false, text: null };
    }

    throw error;
  }
};

const writeConfig = async ({
  path,
  text,
}: {
  path: string;
  text: string;
}): Promise<void> => {
  const directory = dirname(path);
  const temporaryPath = join(
    directory,
    `.${randomBytes(12).toString("hex")}.tmp`,
  );

  await mkdir(directory, { recursive: true });

  try {
    await writeFile(temporaryPath, text, { encoding: "utf8", flag: "wx" });
    await rename(temporaryPath, path);
  } catch (error: unknown) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
};

/**
 * Configure one agent provider in the selected workspace.
 */
export const setupAgent = async ({
  enableAttention,
  confirm,
  directory,
  provider,
}: {
  enableAttention: boolean;
  confirm: (input: {
    path: string;
    provider: AgentProvider;
  }) => Promise<boolean>;
  directory?: string;
  provider: AgentProvider;
}): Promise<AgentSetupResult> => {
  const { path: workspacePath } = await resolveWorkspace(
    directory === undefined ? {} : { directory },
  );
  const hookAdapter = selectAgentHookAdapter(provider);
  const path = join(workspacePath, hookAdapter.hookSetup.configPath);
  const { input, present, text } = await readConfig(path);
  const newline = text?.includes("\r\n") === true ? "\r\n" : "\n";

  const config = hookAdapter.hookSetup.configure({
    enableAttention,
    input,
  });

  if (text !== null && isDeepStrictEqual(input, config)) {
    return "unchanged";
  }

  if (!(await confirm({ path, provider }))) {
    return "cancelled";
  }

  await writeConfig({
    path,
    text: `${JSON.stringify(config, null, 2).replaceAll("\n", newline)}${newline}`,
  });

  return present ? "updated" : "configured";
};
