/**
 * The shared local-proxy credential.
 *
 * One random token, minted on first use into a `0600` file under the
 * nemocode home, is what proves a caller is the owner of this install. Two
 * separate consumers need it, which is why it lives here rather than in
 * either of them:
 *
 *  - The launcher hands it to the spawned agent, which presents it on every
 *    `/v1/*` request so the daemon can bind that traffic to a session.
 *  - The daemon checks it on `/internal/*`, its control plane.
 *
 * It cannot live in `daemon/launch.ts` (where it used to) now that the daemon
 * itself checks it: `launch.ts` imports from `server.ts`, so `server.ts`
 * importing back from `launch.ts` would close an import cycle. A leaf module
 * both sides depend on keeps the graph acyclic.
 *
 * The security model is deliberately modest and worth stating plainly:
 * holding this token is equivalent to being able to read a `0600` file in the
 * user's home directory. It defends the control plane against *other local
 * processes running as other users*, and against a stray unauthenticated
 * request from software that happens to probe loopback ports. It is not a
 * defence against code already running as this user - such code can simply
 * read the file.
 */

import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensurePrivateDir, nemocodeHome } from "../paths.js";

const LOCAL_PROXY_TOKEN_FILE = "local-proxy-token";

/**
 * Header carrying the token on `/internal/*` calls. Distinct from
 * `Authorization` so an internal control-plane call is never confused with an
 * agent's session traffic, which uses Bearer/x-api-key.
 */
export const INTERNAL_AUTH_HEADER = "x-nemocode-internal";

/**
 * Read the local-proxy token, creating it on first use.
 *
 * Concurrent callers (a launcher racing the daemon's first `/internal/*`
 * check) are serialized through one in-flight create, so they cannot mint
 * divergent tokens or observe a half-written file.
 */
let pendingToken: Promise<string> | undefined;

export async function localProxyAuthToken(): Promise<string> {
  const existing = pendingToken;
  if (existing) {
    return existing;
  }
  const operation = readOrCreateToken();
  pendingToken = operation;
  try {
    return await operation;
  } finally {
    if (pendingToken === operation) {
      pendingToken = undefined;
    }
  }
}

async function readOrCreateToken(): Promise<string> {
  const file = path.join(nemocodeHome(), LOCAL_PROXY_TOKEN_FILE);
  try {
    const token = (await readFile(file, "utf8")).trim();
    if (token) {
      return token;
    }
  } catch {
    // Create below.
  }
  const token = `nemocode-local-${randomBytes(32).toString("base64url")}`;
  await ensurePrivateDir(path.dirname(file));
  await writeFile(file, `${token}\n`, { encoding: "utf8", mode: 0o600 });
  return token;
}
