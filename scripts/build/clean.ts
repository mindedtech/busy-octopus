/**
 * @file Remove generated build output before a complete build.
 */

import { rm } from "node:fs/promises";

await rm("dist", { force: true, recursive: true });
