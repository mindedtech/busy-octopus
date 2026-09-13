/**
 * @file Workspace agent hook and skill setup command.
 */

import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { Argument, Command } from "@commander-js/extra-typings";
import { AgentProvider } from "../../integration/agent/provider.js";
import { setupAgent } from "../../integration/agent/setup.js";
import { loadAgentSkillText } from "./content.js";

const confirmSetup = async ({
  enableAttention,
  path,
  provider,
  skillPath,
}: {
  enableAttention: boolean;
  path: string;
  provider: string;
  skillPath: string | null;
}): Promise<boolean> => {
  console.log(`Provider: ${provider}`);
  console.log(`Configuration: ${path}`);
  console.log(
    `Attention notifications: ${enableAttention ? "enabled" : "disabled"}`,
  );
  console.log(`Agent skill: ${skillPath ?? "disabled"}`);

  const prompt = createInterface({ input: stdin, output: stdout });

  try {
    return /^(?:y|yes)$/iu.test(
      await prompt.question("Apply these changes? [y/N] "),
    );
  } finally {
    prompt.close();
  }
};

export const agentSetupCommand = new Command("setup")
  .description("Configure agent notifications and the optional skill.")
  .addArgument(
    new Argument("<provider>", "Agent hook provider.").choices(
      AgentProvider.options,
    ),
  )
  .option(
    "--enable-attention",
    "Also notify when the agent needs input or permission.",
    false,
  )
  .option("--skill", "Also install the Busy Octopus agent skill.", false)
  .option(
    "--directory <path>",
    "Workspace directory. Defaults to the current directory.",
  )
  .option("--yes", "Apply changes without confirmation.", false)
  .action(
    async (provider, { enableAttention, directory, skill, yes }, command) => {
      try {
        console.log(
          await setupAgent({
            enableAttention,
            confirm: yes
              ? () => Promise.resolve(true)
              : ({ path, skillPath }) =>
                  confirmSetup({
                    enableAttention,
                    path,
                    provider,
                    skillPath,
                  }),
            ...(directory === undefined ? {} : { directory }),
            provider,
            skillText: skill ? await loadAgentSkillText() : null,
          }),
        );
      } catch {
        command.error("busy-octopus: unable to configure the agent.", {
          code: "busy-octopus.agent.setup",
          exitCode: 1,
        });
      }
    },
  );
