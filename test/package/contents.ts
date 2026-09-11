/**
 * @file Explicit file allow-lists for distributable archives.
 */

export const packageFileList = [
  "LICENSE",
  "README.md",
  "dist/cli/main.js",
  "dist/extension/extension.cjs",
  "dist/library/index.d.ts",
  "dist/library/index.js",
  "dist/library/notify.d.ts",
  "dist/library/notify.js",
  "dist/protocol/notification.d.ts",
  "dist/protocol/notification.js",
  "dist/protocol/text.d.ts",
  "dist/protocol/text.js",
  "dist/protocol/workspace.d.ts",
  "dist/protocol/workspace.js",
  "dist/queue/file-system.d.ts",
  "dist/queue/file-system.js",
  "dist/queue/location.d.ts",
  "dist/queue/location.js",
  "dist/queue/native.d.ts",
  "dist/queue/native.js",
  "dist/queue/queue.d.ts",
  "dist/queue/queue.js",
  "dist/workspace/identity.d.ts",
  "dist/workspace/identity.js",
  "dist/workspace/resolution.d.ts",
  "dist/workspace/resolution.js",
  "dist/workspace/queue.d.ts",
  "dist/workspace/queue.js",
  "dist/workspace/runtime.d.ts",
  "dist/workspace/runtime.js",
  "package.json",
];

export const extensionFileList = [
  "[Content_Types].xml",
  "extension.vsixmanifest",
  "extension/LICENSE.txt",
  "extension/changelog.md",
  "extension/dist/extension/extension.cjs",
  "extension/native/windows-notify.ps1",
  "extension/package.json",
  "extension/readme.md",
];
