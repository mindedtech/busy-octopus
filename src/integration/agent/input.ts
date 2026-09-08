/**
 * @file Decode bounded JSON received from an agent hook.
 */

import { z } from "zod";

export const MAXIMUM_AGENT_HOOK_BYTE_COUNT = 65_536;

const utf8Encoder = new TextEncoder();

export const AgentHookJson = z
  .string()
  .refine(
    (value) =>
      utf8Encoder.encode(value).byteLength <= MAXIMUM_AGENT_HOOK_BYTE_COUNT,
    {
      error: `Agent hook input must not exceed ${MAXIMUM_AGENT_HOOK_BYTE_COUNT} UTF-8 bytes.`,
    },
  )
  .transform((value, context): unknown => {
    try {
      return JSON.parse(value);
    } catch {
      context.issues.push({
        code: "custom",
        input: value,
        message: "Agent hook input must be valid JSON.",
      });

      return z.NEVER;
    }
  })
  .describe("Bounded agent hook JSON input.");
