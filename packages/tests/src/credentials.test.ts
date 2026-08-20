import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  ANONYMOUS_DEMO_TOKEN,
  DEMO_BASE_URL,
  resolveRelayCredentials,
} from "../../cli/src/lib/credentials.js";
import { NEBIUS_BASE_URL } from "../../models/src/index.js";

/** Write a config.json into a throwaway home and return that home. */
function homeWith(config: Record<string, unknown>): string {
  const home = mkdtempSync(join(tmpdir(), "nemo-creds-"));
  mkdirSync(join(home, ".nemocode"));
  writeFileSync(join(home, ".nemocode", "config.json"), JSON.stringify(config), { mode: 0o600 });
  return home;
}

describe("relay credential resolution", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("demo mode swaps the endpoint, not just the key", () => {
    // The whole point of resolving both together: a demo session pointed at
    // Nebius would present a token Nebius never issued.
    return resolveRelayCredentials({ home: homeWith({ mode: "demo" }) }).then((c) => {
      expect(c.mode).toBe("demo");
      expect(c.baseUrl).toBe(DEMO_BASE_URL);
      expect(c.apiKey).toBe(ANONYMOUS_DEMO_TOKEN);
      expect(c.baseUrl).not.toBe(NEBIUS_BASE_URL);
    });
  });

  test("an issued demo token is used when present", async () => {
    const c = await resolveRelayCredentials({
      home: homeWith({ mode: "demo", demoToken: "demo-abc123" }),
    });
    expect(c.apiKey).toBe("demo-abc123");
  });

  test("a stored key means byok against Nebius", async () => {
    const c = await resolveRelayCredentials({ home: homeWith({ apiKey: "nebius-key" }) });
    expect(c.mode).toBe("byok");
    expect(c.baseUrl).toBe(NEBIUS_BASE_URL);
    expect(c.apiKey).toBe("nebius-key");
  });

  test("an explicit --api-key wins over stored demo mode", async () => {
    // Passing a key is an unambiguous statement about which upstream you want;
    // silently routing it to the demo endpoint would send a user's own Nebius
    // key to a server that has no use for it.
    const c = await resolveRelayCredentials({
      apiKey: "explicit-key",
      home: homeWith({ mode: "demo", demoToken: "demo-abc123" }),
    });
    expect(c.mode).toBe("byok");
    expect(c.baseUrl).toBe(NEBIUS_BASE_URL);
    expect(c.apiKey).toBe("explicit-key");
  });

  test("a config written before demo mode existed stays byok", async () => {
    // Existing installs have no `mode` field and already supplied a key. They
    // must not be switched to a shared endpoint by an upgrade.
    const c = await resolveRelayCredentials({ home: homeWith({ apiKey: "legacy-key" }) });
    expect(c.mode).toBe("byok");
    expect(c.apiKey).toBe("legacy-key");
  });

  test("falls back to NEBIUS_API_KEY when nothing is stored", async () => {
    vi.stubEnv("NEBIUS_API_KEY", "env-key");
    const c = await resolveRelayCredentials({ home: homeWith({}) });
    expect(c.mode).toBe("byok");
    expect(c.apiKey).toBe("env-key");
  });

  test("reports byok with an empty key when nothing is configured", async () => {
    vi.stubEnv("NEBIUS_API_KEY", "");
    const c = await resolveRelayCredentials({ home: homeWith({}) });
    expect(c.mode).toBe("byok");
    expect(c.apiKey).toBe("");
  });

  test("the demo endpoint is overridable for staging and forks", async () => {
    vi.stubEnv("NEMOCODE_DEMO_BASE_URL", "https://staging.example.com");
    const c = await resolveRelayCredentials({ home: homeWith({ mode: "demo" }) });
    // Normalized to /v1 so it is drop-in for the OpenAI-compatible clients.
    expect(c.baseUrl).toBe("https://staging.example.com/v1");
  });
});
