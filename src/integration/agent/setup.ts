/**
 * @file Install Busy Octopus hooks and skills in workspace agent configuration.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { hasFileSystemErrorCode } from "../../file-system/error.js";
import { readOptionalTextFile, writeTextFile } from "../../file-system/text.js";
import { resolveWorkspace } from "../../workspace/resolution.js";
import { type AgentProvider, selectAgentAdapter } from "./provider.js";
import { agentSkillPathMap, installAgentSkill } from "./skill.js";

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
    if (hasFileSystemErrorCode(error, "ENOENT")) {
      return { input: {}, present: false, text: null };
    }

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
  skillText,
}: {
  enableAttention: boolean;
  confirm: (input: {
    path: string;
    provider: AgentProvider;
    skillPath: string | null;
  }) => Promise<boolean>;
  directory?: string;
  provider: AgentProvider;
  skillText: string | null;
}): Promise<AgentSetupResult> => {
  const { path: workspacePath } = await resolveWorkspace(
    directory === undefined ? {} : { directory },
  );
  const agentAdapter = selectAgentAdapter(provider);
  const path = join(workspacePath, agentAdapter.hookSetup.configPath);
  const { input, present, text } = await readConfig(path);
  const newline = text?.includes("\r\n") === true ? "\r\n" : "\n";
  const config = agentAdapter.hookSetup.configure({
    enableAttention,
    input,
  });
  const configCurrent = text !== null && isDeepStrictEqual(input, config);
  const skillPath =
    skillText === null
      ? null
      : join(workspacePath, agentSkillPathMap[agentAdapter.skillTarget]);
  const skillCurrent =
    skillPath === null || (await readOptionalTextFile(skillPath)) === skillText;

  if (configCurrent && skillCurrent) {
    return "unchanged";
  }

  if (!(await confirm({ path, provider, skillPath }))) {
    return "cancelled";
  }

  if (!configCurrent) {
    await writeTextFile({
      path,
      text: `${JSON.stringify(config, null, 2).replaceAll("\n", newline)}${newline}`,
    });
  }

  if (skillText !== null && !skillCurrent) {
    await installAgentSkill({
      directory: workspacePath,
      target: agentAdapter.skillTarget,
      text: skillText,
    });
  }

  return present ? "updated" : "configured";
};
