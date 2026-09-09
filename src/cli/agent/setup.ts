/**
 * @file Workspace agent hook setup command.
 */

import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { Argument, Command } from "@commander-js/extra-typings";
import { AgentProvider } from "../../integration/agent/provider.js";
import { setupAgent } from "../../integration/agent/setup.js";

const confirmSetup = async ({
  enableAttention,
  path,
  provider,
}: {
  enableAttention: boolean;
  path: string;
  provider: string;
}): Promise<boolean> => {
  console.log(`Provider: ${provider}`);
  console.log(`Configuration: ${path}`);
  console.log(
    `Attention notifications: ${enableAttention ? "enabled" : "disabled"}`,
  );

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
  .description("Configure lifecycle notifications for an agent.")
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
  .option(
    "--directory <path>",
    "Workspace directory. Defaults to the current directory.",
  )
  .option("--yes", "Apply changes without confirmation.", false)
  .action(async (provider, { enableAttention, directory, yes }, command) => {
    try {
      console.log(
        await setupAgent({
          enableAttention,
          confirm: yes
            ? () => Promise.resolve(true)
            : ({ path }) =>
                confirmSetup({
                  enableAttention,
                  path,
                  provider,
                }),
          ...(directory === undefined ? {} : { directory }),
          provider,
        }),
      );
    } catch {
      command.error("busy-octopus: unable to configure agent hooks.", {
        code: "busy-octopus.agent.setup",
        exitCode: 1,
      });
    }
  });
