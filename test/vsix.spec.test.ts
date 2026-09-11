/**
 * @file Verify the files in the distributable VS Code extension archive.
 */

import { readFile } from "node:fs/promises";
import { unzipSync } from "fflate";
import { expect, it } from "vitest";
import { z } from "zod";
import {
  extensionArchivePath,
  packageManifest,
} from "../scripts/package/metadata.js";
import { extensionFileList } from "./package/contents.js";

it("contains only the extension runtime and required metadata", async () => {
  expect(
    Object.keys(
      unzipSync(new Uint8Array(await readFile(extensionArchivePath))),
    ).toSorted(),
  ).toEqual(extensionFileList.toSorted());
});

it("targets the Busy Octopus UI extension", async () => {
  const archive = unzipSync(
    new Uint8Array(await readFile(extensionArchivePath)),
  );
  const manifest = z
    .object({
      capabilities: z.object({
        untrustedWorkspaces: z.object({ supported: z.literal(false) }),
        virtualWorkspaces: z.object({ supported: z.literal(false) }),
      }),
      contributes: z.object({
        commands: z.array(z.object({ command: z.string() })),
        configuration: z.object({
          properties: z.record(z.string(), z.object({ default: z.boolean() })),
        }),
      }),
      extensionKind: z.tuple([z.literal("ui")]),
      name: z.literal(packageManifest.name),
      publisher: z.literal(packageManifest.publisher),
    })
    .parse(
      JSON.parse(new TextDecoder().decode(archive["extension/package.json"])),
    );

  expect(manifest).toMatchObject({
    capabilities: {
      untrustedWorkspaces: { supported: false },
      virtualWorkspaces: { supported: false },
    },
    contributes: {
      commands: [{ command: "busyOctopus.showTestNotification" }],
      configuration: {
        properties: {
          "busyOctopus.detail.enable": { default: true },
          "busyOctopus.focusSuppression.enable": { default: true },
          "busyOctopus.editor.enable": { default: false },
          "busyOctopus.windows.notification.enable": { default: true },
          "busyOctopus.windows.notification.sound.enable": { default: false },
          "busyOctopus.windows.taskbar.flash.enable": { default: true },
        },
      },
    },
    extensionKind: ["ui"],
    name: packageManifest.name,
    publisher: packageManifest.publisher,
  } satisfies typeof manifest);
});
