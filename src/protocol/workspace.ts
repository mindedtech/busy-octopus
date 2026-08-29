/**
 * @file Define strict workspace association for notification requests.
 */

import { z } from "zod";
import { boundText } from "./text.js";

export const WorkspaceLabel = boundText({
  domain: "Workspace label",
  maximumCodePointCount: 120,
})
  .nullable()
  .describe("Provide a user-visible workspace label when available.");

export type WorkspaceLabel = z.infer<typeof WorkspaceLabel>;

export const WorkspaceBranch = boundText({
  domain: "Workspace branch",
  maximumCodePointCount: 256,
})
  .nullable()
  .describe("Provide a user-visible branch label when available.");

export type WorkspaceBranch = z.infer<typeof WorkspaceBranch>;

export const WorkspaceDisplay = z
  .strictObject({
    label: WorkspaceLabel,
    branch: WorkspaceBranch,
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
