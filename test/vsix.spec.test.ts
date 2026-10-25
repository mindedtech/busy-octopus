/**
 * @file Verify the files in the distributable VS Code extension archive.
 */

import { readFile } from "node:fs/promises";
import { unzipSync } from "fflate";
import { assert, expect, it } from "vitest";
import { z } from "zod";
import {
  extensionArchivePath,
  packageManifest,
} from "../scripts/package/metadata.js";
import { extensionFileList } from "./package/contents.js";

// The Marketplace rejects a larger icon at publication.
const MAXIMUM_ICON_DIMENSION = 1_024;

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
      icon: z.literal("assets/icon.png"),
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
    icon: "assets/icon.png",
    name: packageManifest.name,
    publisher: packageManifest.publisher,
  } satisfies typeof manifest);
  expect(archive[`extension/${manifest.icon}`]).toEqual(
    new Uint8Array(await readFile(manifest.icon)),
  );
});

it("keeps the icon within the Marketplace dimension limit", async () => {
  const icon = unzipSync(new Uint8Array(await readFile(extensionArchivePath)))[
    `extension/${packageManifest.icon}`
  ];

  assert(icon !== undefined);
  // A PNG signature is followed by the IHDR chunk, whose data starts with the width and height.
  expect(Array.from(icon.subarray(0, 8))).toEqual([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  expect(new TextDecoder().decode(icon.subarray(12, 16))).toBe("IHDR");

  const view = new DataView(icon.buffer, icon.byteOffset, icon.byteLength);

  expect(view.getUint32(16)).toBeLessThanOrEqual(MAXIMUM_ICON_DIMENSION);
  expect(view.getUint32(20)).toBeLessThanOrEqual(MAXIMUM_ICON_DIMENSION);
});
