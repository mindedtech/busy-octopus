/**
 * @file Define strict workspace association for notification requests.
 */

import { z } from "zod";
import { boundText } from "./text.js";

export const WorkspaceDisplay = z
  .strictObject({
    label: boundText({
      domain: "Workspace label",
      maximumCodePointCount: 120,
    })
      .nullable()
      .describe("Provide a user-visible workspace label when available."),
    branch: boundText({
      domain: "Workspace branch",
      maximumCodePointCount: 256,
    })
      .nullable()
      .describe("Provide a user-visible branch label when available."),
  })
  .describe("Provide optional user-visible workspace context.");

export type WorkspaceDisplay = z.infer<typeof WorkspaceDisplay>;

export const WorkspaceContext = z
  .strictObject({
    instanceId: boundText({
      domain: "Workspace instance identifier",
      maximumCodePointCount: 128,
    }).describe("Identify the workspace instance used for routing."),
    display: WorkspaceDisplay,
  })
  .describe("Associate a notification with a resolved workspace.");

export type WorkspaceContext = z.infer<typeof WorkspaceContext>;
