/**
 * The relay's environment-variable namespace.
 *
 * Every tunable is read through here rather than off `process.env` directly,
 * because the namespace has two spellings. `NEMORELAY_*` is the current one;
 * `KIMIRELAY_*` is what shipped before the rename and is still honored.
 *
 * The fallback is not decoration. These variables are how an existing install
 * is configured - `KIMIRELAY_HOME` in particular points at the directory
 * holding the user's Nebius and Tavily keys - so dropping the old spelling
 * outright would silently relocate a working install's config and make its
 * stored credentials appear to vanish. New name wins; old name keeps working.
 *
 * Only the *variable* names changed. The home directory is still `.kimirelay`
 * and the commands are still `klaude`/`kodex`/`openkode`/`kpi`: renaming those
 * would orphan existing installs' config and PATH entries, which is a
 * migration, not a rename.
 */

/** Suffix after the namespace prefix, e.g. "HOME" for NEMORELAY_HOME. */
export type RelayEnvName = string;

const CURRENT_PREFIX = "NEMORELAY_";
const LEGACY_PREFIX = "KIMIRELAY_";

/**
 * Read a namespaced variable, preferring the current spelling.
 *
 * An empty string counts as "set" for the current name only when it is
 * genuinely present, matching `process.env` semantics - callers that treat
 * empty as unset already do their own truthiness check.
 */
export function relayEnv(
  name: RelayEnvName,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return env[`${CURRENT_PREFIX}${name}`] ?? env[`${LEGACY_PREFIX}${name}`];
}

/** True when the variable is set (either spelling) to exactly "1". */
export function relayEnvFlag(name: RelayEnvName, env: NodeJS.ProcessEnv = process.env): boolean {
  return relayEnv(name, env) === "1";
}

/** Parse a namespaced variable as a base-10 integer, or undefined. */
export function relayEnvInt(
  name: RelayEnvName,
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
export function relayEnvKey(name: RelayEnvName): string {
  return `${CURRENT_PREFIX}${name}`;
}
