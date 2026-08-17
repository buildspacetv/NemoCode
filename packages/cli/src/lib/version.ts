import { readFileSync } from "node:fs";

/**
 * Single source of truth for the CLI version. Release bundles receive the
 * root package version from `scripts/build-bundle.sh`; local `tsc` builds read
 * the CLI package.json next to the compiled dist output.
 *
 * This is the one namespaced variable that must NOT go through `relayEnv`.
 * The release build bakes the version in with `bun build --define`, which is a
 * literal text substitution over the source: it can only replace an exact
 * `process.env.NEMORELAY_VERSION` occurrence. Behind a helper call there is no
 * such literal to replace, so the bundle would silently fall back to
 * `readPackageVersion()` - which finds no package.json next to a single-file
 * bundle - and report `0.0.0-dev`. A released binary that thinks it is
 * 0.0.0-dev considers every published version newer and re-downloads forever.
 *
 * Both spellings are literals so a `--define` against either one substitutes.
 */
const BAKED_VERSION = process.env.NEMORELAY_VERSION ?? process.env.KIMIRELAY_VERSION;

export const VERSION: string = BAKED_VERSION ?? readPackageVersion() ?? "0.0.0-dev";

function readPackageVersion(): string | undefined {
  try {
    const packageJsonUrl = new URL("../../package.json", import.meta.url);
    const packageJson = JSON.parse(readFileSync(packageJsonUrl, "utf8")) as { version?: unknown };
    return typeof packageJson.version === "string" ? packageJson.version : undefined;
  } catch {
    return undefined;
  }
}
