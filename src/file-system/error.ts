/**
 * @file Classify Node.js filesystem failures.
 */

type FileSystemErrorCode = "EEXIST" | "ENOENT";

/**
 * Check whether an unknown failure carries a supported filesystem error code.
 */
export const hasFileSystemErrorCode = (
  error: unknown,
  code: FileSystemErrorCode,
): boolean => error instanceof Error && "code" in error && error.code === code;
