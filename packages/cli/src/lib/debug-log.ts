import { appendFile } from "node:fs/promises";

let warnedAboutDebugLogWrite = false;

export function writeDebugLogLine(line: string): void {
  process.stderr.write(line);

  const logPath = process.env.NEMOCODE_DEBUG_LOG;
  if (!logPath) {
    return;
  }

  void appendFile(logPath, line).catch((err: unknown) => {
    if (warnedAboutDebugLogWrite) {
      return;
    }
    warnedAboutDebugLogWrite = true;
    process.stderr.write(
      `[nemocode debug] failed to append debug log: ${
        err instanceof Error ? err.message : String(err)
      }\n`,
    );
  });
}
