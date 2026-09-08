/**
 * @file Agent lifecycle hook command.
 */

import { Buffer } from "node:buffer";
import { stderr, stdin, stdout } from "node:process";
import { Argument, Command } from "@commander-js/extra-typings";
import { runAgentHook } from "../../integration/agent/hook.js";
import { MAXIMUM_AGENT_HOOK_BYTE_COUNT } from "../../integration/agent/input.js";
import { AgentProvider } from "../../integration/agent/provider.js";
import { notify } from "../../library/notify.js";

export const agentHookCommand = new Command("hook")
  .description("Receive a lifecycle event from an agent.")
  .addArgument(
    new Argument("<provider>", "Agent hook provider.").choices(
      AgentProvider.options,
    ),
  )
  .action(async (provider) => {
    stdout.write(
      await runAgentHook({
        notify,
        provider,
        readInput: async () => {
          stdin.setEncoding("utf8");

          let byteCount = 0;
          let value = "";

          for await (const chunk of stdin) {
            const text = String(chunk);
            byteCount += Buffer.byteLength(text);

            if (byteCount > MAXIMUM_AGENT_HOOK_BYTE_COUNT) {
              throw new RangeError("Agent hook input exceeds the byte limit.");
            }

            value += text;
          }

          return value;
        },
        warn: () => {
          stderr.write("busy-octopus: unable to process the agent hook.\n");
        },
      }),
    );
  });
