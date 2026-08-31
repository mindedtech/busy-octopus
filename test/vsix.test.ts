/**
 * @file Verify the files in the distributable VS Code extension archive.
 */

import { readFile } from "node:fs/promises";
import { unzipSync } from "fflate";
import { expect, it } from "vitest";
import { z } from "zod";

const fileList = [
  "[Content_Types].xml",
  "extension.vsixmanifest",
  "extension/LICENSE.txt",
  "extension/dist/extension/extension.cjs",
  "extension/package.json",
  "extension/readme.md",
];

it("contains only the extension runtime and required metadata", async () => {
  expect(
    Object.keys(
      unzipSync(
        new Uint8Array(await readFile("artifacts/busy-octopus-0.0.0.vsix")),
      ),
    ).toSorted(),
  ).toEqual(fileList);
});

it("targets the Busy Octopus UI extension", async () => {
  const archive = unzipSync(
    new Uint8Array(await readFile("artifacts/busy-octopus-0.0.0.vsix")),
  );
  const manifest = z
    .object({
      capabilities: z.object({
        untrustedWorkspaces: z.object({ supported: z.literal(false) }),
        virtualWorkspaces: z.object({ supported: z.literal(false) }),
      }),
      extensionKind: z.tuple([z.literal("ui")]),
      name: z.literal("busy-octopus"),
      publisher: z.literal("mindedtech"),
    })
    .parse(
      JSON.parse(new TextDecoder().decode(archive["extension/package.json"])),
    );

  expect(manifest).toMatchObject({
    capabilities: {
      untrustedWorkspaces: { supported: false },
      virtualWorkspaces: { supported: false },
    },
    extensionKind: ["ui"],
    name: "busy-octopus",
    publisher: "mindedtech",
  });
});
