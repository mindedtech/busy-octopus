/**
 * @file Read and replace UTF-8 text files.
 */

import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { hasFileSystemErrorCode } from "./error.js";

/**
 * Read a text file when it exists.
 *
 * @throws {unknown} If reading fails for a reason other than a missing path.
 */
export const readOptionalTextFile = async (
  path: string,
): Promise<string | null> => {
  try {
    return await readFile(path, "utf8");
  } catch (error: unknown) {
    if (hasFileSystemErrorCode(error, "ENOENT")) {
      return null;
    }

    throw error;
  }
};

/**
 * Replace a text file through an atomic rename.
 *
 * @throws {unknown} If replacing the file fails.
 */
export const writeTextFile = async ({
  path,
  text,
}: {
  path: string;
  text: string;
}): Promise<void> => {
  const directory = dirname(path);
  const temporaryPath = join(
    directory,
    `.${randomBytes(12).toString("hex")}.tmp`,
  );

  await mkdir(directory, { recursive: true });

  try {
    await writeFile(temporaryPath, text, { encoding: "utf8", flag: "wx" });
    await rename(temporaryPath, path);
  } catch (error: unknown) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
};
