/**
 * @file Verify bounded protocol text behavior.
 */

import { describe, expect, it } from "vitest";
import { boundText } from "./text.js";

const TwoCodePointText = boundText({
  domain: "Fixture text",
  maximumCodePointCount: 2,
});

describe("boundText", () => {
  it("preserves accepted text", () => {
    const NineCodePointText = boundText({
      domain: "Fixture text",
      maximumCodePointCount: 9,
    });

    expect(NineCodePointText.parse("  value  ")).toBe("  value  ");
  });

  it("rejects whitespace-only text", () => {
    expect(TwoCodePointText.safeParse(" \\t\\n").success).toBe(false);
  });

  it("counts basic multilingual plane characters as code points", () => {
    expect(TwoCodePointText.safeParse("ø界").success).toBe(true);
    expect(TwoCodePointText.safeParse("ø界a").success).toBe(false);
  });

  it("counts astral characters as single code points", () => {
    expect(TwoCodePointText.safeParse("😀a").success).toBe(true);
    expect(TwoCodePointText.safeParse("😀ab").success).toBe(false);
  });
});
