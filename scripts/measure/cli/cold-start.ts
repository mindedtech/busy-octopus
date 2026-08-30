/**
 * @file Measure one built CLI help invocation without enforcing a threshold.
 */

import { execFile } from "node:child_process";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { execPath } from "node:process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const startTime = performance.now();
await execFileAsync(execPath, [join("dist", "cli", "main.js"), "--help"], {
  windowsHide: true,
});
const duration = performance.now() - startTime;
console.log(`Busy Octopus CLI cold start: ${duration.toFixed(1)} ms`);
