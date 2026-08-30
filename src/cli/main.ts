#!/usr/bin/env node
/**
 * @file Run the Busy Octopus command-line interface.
 */

import { program } from "./cli.js";

await program.parseAsync();
