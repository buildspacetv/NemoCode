/**
 * The CLI's environment-variable namespace.
 *
 * Every tunable is read through here rather than off `process.env` directly,
 * because the namespace has had three spellings. `NEMOCODE_*` is current;
 * `NEMORELAY_*` and `KIMIRELAY_*` are earlier names and are still honored.
 *
 * The fallbacks are not decoration. These variables are how an already
 * installed user is configured, and `*_HOME` points at the directory holding
 * their Nebius and Tavily keys - so honoring only the newest spelling would
 * silently relocate a working install and make its stored credentials look
 * like they had vanished. Newest name wins; older names keep working.
 */

/** Suffix after the namespace prefix, e.g. "HOME" for NEMOCODE_HOME. */
export type EnvName = string;

/** Ordered most-current first. Everything after the first is legacy. */
const PREFIXES = ["NEMOCODE_", "NEMORELAY_", "KIMIRELAY_"] as const;

/** Read a namespaced variable, preferring the most current spelling. */
export function relayEnv(name: EnvName, env: NodeJS.ProcessEnv = process.env): string | undefined {
  for (const prefix of PREFIXES) {
    const value = env[`${prefix}${name}`];
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

/** True when the variable is set (any spelling) to exactly "1". */
export function relayEnvFlag(name: EnvName, env: NodeJS.ProcessEnv = process.env): boolean {
  return relayEnv(name, env) === "1";
}

/** Parse a namespaced variable as a base-10 integer, or undefined. */
export function relayEnvInt(
  name: EnvName,
  env: NodeJS.ProcessEnv = process.env,
): number | undefined {
  const raw = relayEnv(name, env);
  if (raw === undefined || raw === "") {
    return undefined;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** The current-spelling variable name, for use when SETTING a child's env. */
export function relayEnvKey(name: EnvName): string {
  return `${PREFIXES[0]}${name}`;
}

/** Home directory names, newest first, matching the prefix order above. */
export const HOME_DIR_NAMES = [".nemocode", ".kimirelay"] as const;
