/**
 * Where a session's inference credentials come from.
 *
 * Two modes, resolved together because they move together: demo mode is not
 * "BYOK without a key", it is a different upstream. Swapping only the key
 * would point a demo session at Nebius with a token Nebius has never issued.
 *
 *  - `byok`  - the user's own Nebius key, talking to Nebius directly. This is
 *              how the relay has always worked and stays the default.
 *  - `demo`  - a relay-hosted, OpenAI-compatible endpoint that holds the
 *              upstream key server-side. The user never sees a provider key,
 *              which is the point: it is what lets someone start from the
 *              website without signing up for anything.
 *
 * Demo deliberately reuses the same OpenAI-compatible shape as Nebius, so
 * everything downstream - the daemon, both wire-format translators, cost
 * tracking, context fitting - is identical in both modes. The mode is decided
 * once, here, and never again.
 */

import { resolveNebiusBaseUrl } from "./nebius-core.js";
import { relayEnv } from "./env.js";

export type RelayMode = "byok" | "demo";

export type RelayCredentials = {
  mode: RelayMode;
  /** OpenAI-compatible base URL, always ending in /v1. */
  baseUrl: string;
  /** Bearer token for that base URL. Never a provider key in demo mode. */
  apiKey: string;
};

/**
 * The hosted demo endpoint. Overridable so a fork, a staging deploy, or a
 * local server can be pointed at without a rebuild.
 */
export const DEMO_BASE_URL = "https://nemocode.org/api/demo/v1";

/**
 * Sent as the bearer when a demo session has no issued token. The demo server
 * is expected to rate-limit anonymous callers by address; the token exists so
 * the website can hand out a better-known identity later without the CLI
 * changing shape.
 */
export const ANONYMOUS_DEMO_TOKEN = "anonymous";

export function resolveDemoBaseUrl(): string {
  const override = relayEnv("DEMO_BASE_URL")?.trim();
  if (!override) {
    return DEMO_BASE_URL;
  }
  const normalized = override.replace(/\/+$/, "");
  return normalized.endsWith("/v1") ? normalized : `${normalized}/v1`;
}

export type ResolveRelayCredentialsOptions = {
  /** An explicit --api-key. Always wins, and always means BYOK. */
  apiKey?: string | undefined;
  /** Home directory to read stored config from. */
  home?: string | undefined;
};

/**
 * Resolve the credentials for a session.
 *
 * Precedence, highest first:
 *   1. an explicit `--api-key` (BYOK - passing a key is an unambiguous
 *      statement about which upstream you want)
 *   2. stored mode `demo`
 *   3. a stored BYOK key
 *   4. `NEBIUS_API_KEY` from the environment
 *
 * Returns an empty `apiKey` in BYOK mode when nothing is configured; callers
 * already surface that as "run `nemo configure`", and deciding that here would
 * put a user-facing policy in a resolution function.
 */
export async function resolveRelayCredentials({
  apiKey,
  home,
}: ResolveRelayCredentialsOptions): Promise<RelayCredentials> {
  if (apiKey?.trim()) {
    return { mode: "byok", baseUrl: resolveNebiusBaseUrl(), apiKey: apiKey.trim() };
  }

  if (home) {
    const { readGlobalConfig, resolveStoredApiKey } = await import("./global-config.js");
    const config = await readGlobalConfig(home);
    if (config.mode === "demo") {
      return {
        mode: "demo",
        baseUrl: resolveDemoBaseUrl(),
        apiKey: config.demoToken?.trim() || ANONYMOUS_DEMO_TOKEN,
      };
    }
    const stored = resolveStoredApiKey(config.apiKey);
    if (stored) {
      return { mode: "byok", baseUrl: resolveNebiusBaseUrl(), apiKey: stored };
    }
  }

  return {
    mode: "byok",
    baseUrl: resolveNebiusBaseUrl(),
    apiKey: process.env.NEBIUS_API_KEY?.trim() ?? "",
  };
}

/**
 * Human label for whichever upstream a base URL points at.
 *
 * The launch banner names the destination, so it has to follow the mode: a
 * demo session announcing "Nebius Token Factory" would be telling the user
 * their traffic goes somewhere it does not.
 */
export function upstreamLabel(baseUrl: string): string {
  return baseUrl === resolveDemoBaseUrl()
    ? "NemoCode demo (shared, rate-limited)"
    : "Nebius Token Factory";
}
