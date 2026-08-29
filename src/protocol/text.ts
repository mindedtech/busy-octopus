/**
 * @file Define reusable validation for bounded protocol text.
 */

import { z } from "zod";

/**
 * Create a string schema that preserves nonblank text within a code-point limit.
 */
export const boundText = ({
  domain,
  maximumCodePointCount,
}: {
  domain: string;
  maximumCodePointCount: number;
}): z.ZodString =>
  z
    .string()
    .refine((value) => value.trim().length > 0, {
      error: `${domain} must not be blank.`,
    })
    .refine((value) => Array.from(value).length <= maximumCodePointCount, {
      error: `${domain} must contain at most ${maximumCodePointCount} Unicode code points.`,
    });
