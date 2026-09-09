/**
 * @file Verify agent hook input decoding and limits.
 */

import { describe, expect, it } from "vitest";
import { AgentHookJson, MAXIMUM_AGENT_HOOK_BYTE_COUNT } from "./input.js";

describe("AgentHookJson", () => {
  it("decodes JSON", () => {
    expect(
      AgentHookJson.parse(JSON.stringify({ hook_event_name: "Stop" })),
    ).toEqual({
      hook_event_name: "Stop",
    });
  });

  it("rejects input beyond the byte limit", () => {
    expect(() =>
      AgentHookJson.parse(
        JSON.stringify("x".repeat(MAXIMUM_AGENT_HOOK_BYTE_COUNT)),
      ),
    ).toThrow(
      `Agent hook input must not exceed ${MAXIMUM_AGENT_HOOK_BYTE_COUNT} UTF-8 bytes.`,
    );
  });

  it("counts UTF-8 bytes", () => {
    expect(() =>
      AgentHookJson.parse(
        JSON.stringify(
          "🐙".repeat(Math.floor(MAXIMUM_AGENT_HOOK_BYTE_COUNT / 4)),
        ),
      ),
    ).toThrow(
      `Agent hook input must not exceed ${MAXIMUM_AGENT_HOOK_BYTE_COUNT} UTF-8 bytes.`,
    );
  });
});
