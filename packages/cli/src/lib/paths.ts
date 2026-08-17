import { relayEnv } from "./env.js";
import os from "node:os";
import path from "node:path";
import { chmod, mkdir } from "node:fs/promises";

/**
 * Resolve the nemocode home directory - the one source of truth for where
 * the pid file, the sqlite session database, the stored API keys, and the
 * codex-app registration file live. Replaces the four byte-identical
 * `resolveNemoCodeHome()` copies that previously lived in
 * `daemon/{storage,server,launch,app-registration}.ts` plus `daemon/state.ts`,
 * plus the cross-process-boundary `isAlive`/`isProcessAlive` duplicates in
 * `state.ts`/`launch.ts`/`codex-app.ts`.
 *
 * The convention seam between the daemon process and the launcher used to leak
 * as duplicated logic: if one copy changed the resolution, the others would
 * break silently. One home, one liveness check.
 *
 * `NEMOCODE_HOME` names the `.nemocode` directory itself, matching
 * `scripts/install.sh` and `autoupdate.ts`. It MUST be honored here and
 * nowhere else: a second resolver that ignored it is what previously split a
 * custom-home install in two, sending the daemon's pid/sqlite/token to
 * `$NEMOCODE_HOME` while `config.json` - which holds the Nebius and Tavily
 * keys - was still read from `~/.nemocode`.
 *
 * `base` exists only so callers that already thread an explicit home through
 * their own signature (config, telemetry, codex-app, and their tests) can
 * reuse it. The environment override still wins, exactly as it does for the
 * zero-argument daemon callers.
 */
export function nemocodeHome(base = os.homedir()): string {
  return process.env.NEMOCODE_HOME || path.join(base, ".nemocode");
}

/**
 * Create a directory that only its owner can read, and tighten it if it
 * already exists with looser permissions.
 *
 * Every secret nemocode writes lands under one of these directories: the
 * Nebius and Tavily keys in `config.json`, the local-proxy token, and the
 * session database - whose rows include the API key. Those files are written
 * `0600`, but two things escape per-file modes: SQLite's WAL sidecars
 * (`-wal`/`-shm`) are created by the sqlite library at the process umask and
 * carry recently-written rows, and any future file someone adds here inherits
 * the umask too. Making the directory itself `0700` closes both at the seam
 * rather than one file at a time.
 *
 * `mkdir`'s `mode` only applies at creation, so existing directories from
 * older installs are chmod'ed explicitly. Best-effort on the chmod: a
 * directory we cannot tighten (odd filesystem, Windows) must not stop the CLI.
 */
export async function ensurePrivateDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await chmod(dir, 0o700).catch(() => undefined);
}

/**
 * Whether a pid still has a live process. `process.kill(pid, 0)` sends no
 * signal - it just checks the process exists. ESRCH = dead; EPERM = exists but
 * not ours (treat as alive so we don't reap a session we can't verify).
 */
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}
