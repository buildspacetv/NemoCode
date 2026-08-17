/**
 * Self-update. The installed CLI lives as a single Bun-target JS bundle at
 * `<home>/.nemocode/bin/nemocode.js`, launched by a tiny `nemo`
 * shell wrapper that calls `bun run` on it. To update, we fetch a small
 * `latest.json` manifest from the project site, compare versions, and if newer
 * download the new bundle and atomically rename it over the installed file.
 *
 * The running process keeps the old inode, so the *next* invocation is the new
 * version - we never hot-swap mid-execution. Every failure path is swallowed:
 * an update problem must never block or crash the user's actual command.
 *
 * Integrity is the load-bearing part. The downloaded bundle is executed by
 * every subsequent `claudemo`/`codemo`/… invocation, so a manifest that could
 * name an arbitrary URL, or a bundle nobody checksums, turns any compromise
 * of the release site (or of whatever `NEMOCODE_MANIFEST_URL` points at)
 * into code execution on the user's machine. Two gates close that:
 *
 *  1. The download URL must live on the SAME origin as the manifest it came
 *     from. A manifest can redirect the download within its own origin, but
 *     never off it.
 *  2. The manifest must carry a `sha256` of the bundle, and the bytes must
 *     hash to it before anything is renamed into place. No digest, no update.
 *
 * `NEMOCODE_MANIFEST_URL` therefore stays useful for local mirrors while no
 * longer being a one-variable path to running someone else's code.
 */

import { relayEnv } from "./env.js";
import { readFile, writeFile, rename, stat, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import os from "node:os";
import { VERSION } from "./version.js";
import { refreshLauncherWrappers } from "./wrappers.js";

/** Single origin for the landing page, manifest, and downloadable bundle. */
const UPDATE_ORIGIN = "https://nemocode.org";
/** Override for testing/local mirrors; normally unset. */
function resolveManifestUrl(): string {
  return relayEnv("MANIFEST_URL") ?? `${UPDATE_ORIGIN}/latest.json`;
}

const THROTTLE_MS = 60 * 60 * 1000; // re-check at most once per hour
const OVERALL_TIMEOUT_MS = 10_000;
const FETCH_TIMEOUT_MS = 5_000;

type Manifest = { version: string; url?: string; sha256?: string };

/**
 * Where the install lives. `NEMOCODE_HOME` (when set) is the `.nemocode`
 * directory itself - matching `scripts/install.sh`, which installs the bundle
 * at `$NEMOCODE_HOME/bin/nemocode.js`. When unset, default to
 * `~/.nemocode`.
 */
function resolveInstallDir(): string {
  return relayEnv("HOME") || path.join(os.homedir(), ".nemocode");
}

/** Installed bundle path. `nemo` wrapper runs `bun run` on this. */
function installedBundlePath(): string {
  return path.join(resolveInstallDir(), "bin", "nemocode.js");
}

/**
 * Is the currently-running script the installed bundle? We only self-update the
 * installed copy - a dev run from the repo (`tsc`/source) is left alone.
 */
function isInstalledBundle(): boolean {
  const argv1 = process.argv[1];
  if (!argv1) {
    return false;
  }
  try {
    const resolved = path.resolve(argv1);
    const installed = installedBundlePath();
    // realpath handles macOS /tmp → /private/tmp symlinks, so the comparison
    // matches even when the install dir was reached through a symlinked prefix.
    return realpathSafe(resolved) === realpathSafe(installed);
  } catch {
    return false;
  }
}

function realpathSafe(p: string): string {
  try {
    return require("node:fs").realpathSync(p) as string;
  } catch {
    return p;
  }
}

function throttleFile(): string {
  return path.join(resolveInstallDir(), ".update-check");
}

async function throttled(): Promise<boolean> {
  try {
    const s = await stat(throttleFile());
    return Date.now() - s.mtimeMs < THROTTLE_MS;
  } catch {
    return false;
  }
}

async function touchThrottle(): Promise<void> {
  try {
    await writeFile(throttleFile(), "", { flag: "w" });
  } catch {
    // Non-fatal: worst case we re-check next run.
  }
}

function parseSemver(v: string): [number, number, number] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
  if (!m) {
    return null;
  }
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function isNewer(latest: string, current: string): boolean {
  const a = parseSemver(latest);
  const b = parseSemver(current);
  if (!a || !b) {
    return false;
  }
  for (let i = 0; i < 3; i += 1) {
    const av = a[i];
    const bv = b[i];
    if (av !== bv && av !== undefined && bv !== undefined) {
      return av > bv;
    }
  }
  return false;
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  try {
    return await Promise.race([p, guard]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function fetchManifest(): Promise<Manifest> {
  const res = await withTimeout(
    fetch(resolveManifestUrl(), {
      headers: { "User-Agent": `nemocode/${VERSION}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    }),
    FETCH_TIMEOUT_MS,
  );
  if (!res.ok) {
    throw new Error(`manifest ${res.status}`);
  }
  const data = (await res.json()) as Manifest;
  if (!data?.version) {
    throw new Error("manifest missing version");
  }
  return data;
}

/** Lowercase hex sha256 of the bytes we are about to install. */
export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Resolve the bundle URL a manifest asks for, refusing anything that leaves
 * the manifest's own origin. `manifestUrl` is the URL we actually fetched the
 * manifest from - not the hardcoded default - so a local mirror can serve a
 * self-consistent manifest+bundle pair while a compromised release site still
 * cannot point the download at an unrelated host.
 */
export function resolveBundleUrl(manifest: Manifest, manifestUrl: string): string {
  const origin = new URL(manifestUrl);
  if (manifest.url === undefined) {
    return new URL("/nemocode.js", origin).toString();
  }
  const candidate = new URL(manifest.url, origin);
  if (candidate.origin !== origin.origin) {
    throw new Error(
      `manifest url origin ${candidate.origin} does not match manifest origin ${origin.origin}`,
    );
  }
  return candidate.toString();
}

/**
 * Fetch the bundle, verify it against the manifest's digest, and only then
 * put it in place. The write is atomic (tmp + rename) and the tmp file is
 * removed on any failure, so a rejected download can never be left behind
 * where a later run might mistake it for a real bundle.
 */
async function downloadTo(url: string, dest: string, expectedSha256: string): Promise<void> {
  const res = await withTimeout(
    fetch(url, {
      headers: { "User-Agent": `nemocode/${VERSION}` },
      signal: AbortSignal.timeout(OVERALL_TIMEOUT_MS),
    }),
    OVERALL_TIMEOUT_MS,
  );
  if (!res.ok || !res.body) {
    throw new Error(`download ${res.status}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength === 0) {
    throw new Error("empty download");
  }
  const actual = sha256Hex(buf);
  if (actual !== expectedSha256) {
    throw new Error(
      `sha256 mismatch: manifest says ${expectedSha256}, download hashes to ${actual}`,
    );
  }
  const tmp = `${dest}.new-${process.pid}`;
  try {
    await writeFile(tmp, buf, { mode: 0o644 });
    await rename(tmp, dest);
  } catch (err) {
    await unlink(tmp).catch(() => undefined);
    throw err;
  }
}

/** A manifest digest must be a full lowercase-hex sha256 to be usable. */
function normalizedSha256(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(trimmed) ? trimmed : undefined;
}

/**
 * Check for and apply a self-update. Safe to `await` at startup: throttled to
 * once/hour, bounded by a 10s overall timeout, and never throws. No-op unless
 * the running script is the installed bundle.
 */
export async function maybeSelfUpdate(): Promise<void> {
  // Only the installed bundle self-updates, and only against the deployed
  // release site the bundle was installed from - so this is a safe default-on:
  // dev/source runs no-op, and every failure below is swallowed. Set
  // NEMOCODE_DISABLE_AUTOUPDATE=1 to opt out.
  if (relayEnv("DISABLE_AUTOUPDATE") === "1") {
    return;
  }
  if (!isInstalledBundle()) {
    return; // dev/source run - don't touch it
  }
  if (await throttled()) {
    return;
  }
  await touchThrottle();

  // The launcher wrappers next to the bundle are written by install.sh and
  // otherwise never change; refresh them on the same hourly cadence so wrapper
  // fixes reach existing installs, not just fresh ones. Runs even when the
  // bundle itself is already current.
  try {
    await refreshLauncherWrappers(path.join(resolveInstallDir(), "bin"));
  } catch {
    // Swallowed: wrapper refresh must never break the user's command.
  }

  try {
    const manifestUrl = resolveManifestUrl();
    const manifest = await withTimeout(fetchManifest(), OVERALL_TIMEOUT_MS);
    if (!isNewer(manifest.version, VERSION)) {
      return;
    }
    // Fail closed on a missing/!malformed digest. An unsigned bundle is exactly
    // the thing this gate exists to refuse, so an old manifest that predates
    // the `sha256` field simply does not auto-update - it does not silently
    // fall back to the unverified path.
    const expected = normalizedSha256(manifest.sha256);
    if (expected === undefined) {
      process.stderr.write(
        `nemocode: update to v${manifest.version} skipped - manifest has no valid sha256 digest.\n`,
      );
      return;
    }
    const url = resolveBundleUrl(manifest, manifestUrl);
    await downloadTo(url, installedBundlePath(), expected);
    process.stderr.write(`nemocode: updated to v${manifest.version} (next run uses it)\n`);
  } catch {
    // Swallowed: update failure never breaks the user's command.
  }
}
