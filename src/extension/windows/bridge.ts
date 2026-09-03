/**
 * @file Bounded Windows PowerShell process boundary.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { type ZodType, z } from "zod";

const execFileAsync = promisify(execFile);
const maximumOutputByteCount = 16_384;
const processTimeoutMilliseconds = 5_000;

export const EditorProcessId = z.coerce
  .number()
  .int()
  .positive()
  .max(2_147_483_647)
  .brand("EditorProcessId")
  .describe("Windows editor process identifier.");
export type EditorProcessId = z.infer<typeof EditorProcessId>;

export const EditorWindowHandle = z
  .string()
  .regex(/^[1-9]\d*$/)
  .brand("EditorWindowHandle")
  .describe("Windows editor window handle.");
export type EditorWindowHandle = z.infer<typeof EditorWindowHandle>;

const NativeOperation = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("success") }),
  z.strictObject({ status: z.literal("unavailable") }),
]);

const WindowCapture = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("success"),
    windowHandle: EditorWindowHandle,
  }),
  z.strictObject({
    status: z.literal("unavailable"),
    windowHandle: z.null(),
  }),
]);

/**
 * Content-free result of one native operation.
 */
export type NativeOperation = z.infer<typeof NativeOperation>;

/**
 * Exact editor window handle when the focused window belongs to this editor.
 */
export type WindowCapture = z.infer<typeof WindowCapture>;

const run = async <Result>({
  argumentList,
  Result,
  scriptPath,
  signal,
}: {
  argumentList: string[];
  Result: ZodType<Result>;
  scriptPath: string;
  signal?: AbortSignal;
}): Promise<Result> => {
  const { stdout } = await execFileAsync(
    "powershell.exe",
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      ...argumentList,
    ],
    {
      encoding: "utf8",
      maxBuffer: maximumOutputByteCount,
      ...(signal === undefined ? {} : { signal }),
      timeout: processTimeoutMilliseconds,
      windowsHide: true,
    },
  );

  return Result.parse(JSON.parse(stdout));
};

/**
 * Show a clickable native Windows toast.
 */
export const showWindowsNotification = ({
  activationUri,
  appName,
  body,
  scriptPath,
  signal,
  sound,
  title,
}: {
  activationUri: string;
  appName: string;
  body: string | null;
  scriptPath: string;
  signal: AbortSignal;
  sound: boolean;
  title: string;
}): Promise<NativeOperation> =>
  run({
    argumentList: [
      "-Operation",
      "showNotification",
      "-Title",
      title,
      "-Body",
      body ?? "",
      "-IncludeBody",
      body === null ? "false" : "true",
      "-Sound",
      sound ? "true" : "false",
      "-AppName",
      appName,
      "-ActivationUri",
      activationUri,
    ],
    Result: NativeOperation,
    scriptPath,
    signal,
  });

/**
 * Capture the focused window owned by the editor process tree.
 */
export const captureEditorWindow = ({
  editorProcessId,
  scriptPath,
}: {
  editorProcessId: EditorProcessId;
  scriptPath: string;
}): Promise<WindowCapture> =>
  run({
    argumentList: [
      "-Operation",
      "captureWindow",
      "-EditorProcessId",
      String(editorProcessId),
    ],
    Result: WindowCapture,
    scriptPath,
  });

type TaskbarFlashInput = {
  editorProcessId: EditorProcessId;
  scriptPath: string;
  signal?: AbortSignal;
  windowHandle: EditorWindowHandle;
};

const changeTaskbarFlash = ({
  editorProcessId,
  operation,
  scriptPath,
  signal,
  windowHandle,
}: TaskbarFlashInput & {
  operation: "startTaskbarFlash" | "stopTaskbarFlash";
}): Promise<NativeOperation> =>
  run({
    argumentList: [
      "-Operation",
      operation,
      "-EditorProcessId",
      String(editorProcessId),
      "-EditorWindowHandle",
      windowHandle,
    ],
    Result: NativeOperation,
    scriptPath,
    ...(signal === undefined ? {} : { signal }),
  });

/**
 * Start flashing the captured editor taskbar button.
 */
export const startEditorWindowFlash = (
  input: TaskbarFlashInput,
): Promise<NativeOperation> =>
  changeTaskbarFlash({ ...input, operation: "startTaskbarFlash" });

/**
 * Stop flashing the captured editor taskbar button.
 */
export const stopEditorWindowFlash = (
  input: TaskbarFlashInput,
): Promise<NativeOperation> =>
  changeTaskbarFlash({ ...input, operation: "stopTaskbarFlash" });
