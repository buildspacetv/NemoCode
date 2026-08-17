import { afterEach, describe, expect, test, vi } from "vitest";
import { relayEnv, relayEnvFlag, relayEnvInt, relayEnvKey } from "../../cli/src/lib/env.js";
import { kimirelayHome } from "../../cli/src/lib/paths.js";

/**
 * The variable namespace was renamed KIMIRELAY_* -> NEMORELAY_*. The legacy
 * spelling has to keep working: these variables are how an already-installed
 * user is configured, and KIMIRELAY_HOME in particular points at the directory
 * holding their Nebius and Tavily keys. Dropping it would silently relocate a
 * working install and make its stored credentials look like they vanished.
 */
describe("relay env namespace", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("reads the current NEMORELAY_ spelling", () => {
    vi.stubEnv("NEMORELAY_DEBUG", "1");
    expect(relayEnv("DEBUG")).toBe("1");
    expect(relayEnvFlag("DEBUG")).toBe(true);
  });

  test("still reads the legacy KIMIRELAY_ spelling", () => {
    vi.stubEnv("KIMIRELAY_DEBUG", "1");
    expect(relayEnv("DEBUG")).toBe("1");
    expect(relayEnvFlag("DEBUG")).toBe(true);
  });

  test("the current spelling wins when both are set", () => {
    vi.stubEnv("KIMIRELAY_PORT", "1111");
    vi.stubEnv("NEMORELAY_PORT", "2222");
    expect(relayEnv("PORT")).toBe("2222");
    expect(relayEnvInt("PORT")).toBe(2222);
  });

  test("is undefined when neither is set", () => {
    expect(relayEnv("DEFINITELY_NOT_SET_ANYWHERE")).toBeUndefined();
    expect(relayEnvFlag("DEFINITELY_NOT_SET_ANYWHERE")).toBe(false);
    expect(relayEnvInt("DEFINITELY_NOT_SET_ANYWHERE")).toBeUndefined();
  });

  test("relayEnvInt rejects non-numeric values", () => {
    vi.stubEnv("NEMORELAY_PORT", "not-a-number");
    expect(relayEnvInt("PORT")).toBeUndefined();
  });

  test("relayEnvKey names the current spelling, for setting a child's env", () => {
    expect(relayEnvKey("PORT")).toBe("NEMORELAY_PORT");
  });

  test("an existing install's KIMIRELAY_HOME still locates its config", () => {
    // The concrete regression this guards: a user whose keys live in a custom
    // home must not have that home silently move under the new namespace.
    vi.stubEnv("KIMIRELAY_HOME", "/tmp/legacy-relay-home");
    expect(kimirelayHome()).toBe("/tmp/legacy-relay-home");
  });

  test("NEMORELAY_HOME takes precedence over the legacy home", () => {
    vi.stubEnv("KIMIRELAY_HOME", "/tmp/legacy-relay-home");
    vi.stubEnv("NEMORELAY_HOME", "/tmp/current-relay-home");
    expect(kimirelayHome()).toBe("/tmp/current-relay-home");
  });
});
