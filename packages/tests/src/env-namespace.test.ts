import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { relayEnv, relayEnvFlag, relayEnvInt, relayEnvKey } from "../../cli/src/lib/env.js";
import { nemocodeHome } from "../../cli/src/lib/paths.js";

/**
 * The namespace has been renamed twice: KIMIRELAY_ -> NEMORELAY_ -> NEMOCODE_.
 * The older spellings have to keep working, because these variables are how an
 * already-installed user is configured and *_HOME points at the directory
 * holding their Nebius and Tavily keys. Honoring only the newest name would
 * silently relocate a working install and strand those credentials.
 */
describe("env namespace", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("reads the current NEMOCODE_ spelling", () => {
    vi.stubEnv("NEMOCODE_DEBUG", "1");
    expect(relayEnv("DEBUG")).toBe("1");
    expect(relayEnvFlag("DEBUG")).toBe(true);
  });

  test("still reads both legacy spellings", () => {
    vi.stubEnv("NEMORELAY_DEBUG", "1");
    expect(relayEnv("DEBUG")).toBe("1");
    vi.unstubAllEnvs();
    vi.stubEnv("KIMIRELAY_DEBUG", "1");
    expect(relayEnv("DEBUG")).toBe("1");
  });

  test("newest spelling wins over older ones", () => {
    vi.stubEnv("KIMIRELAY_PORT", "1111");
    vi.stubEnv("NEMORELAY_PORT", "2222");
    vi.stubEnv("NEMOCODE_PORT", "3333");
    expect(relayEnvInt("PORT")).toBe(3333);
  });

  test("is undefined when nothing is set", () => {
    expect(relayEnv("DEFINITELY_NOT_SET_ANYWHERE")).toBeUndefined();
    expect(relayEnvFlag("DEFINITELY_NOT_SET_ANYWHERE")).toBe(false);
    expect(relayEnvInt("DEFINITELY_NOT_SET_ANYWHERE")).toBeUndefined();
  });

  test("relayEnvKey names the current spelling, for setting a child's env", () => {
    expect(relayEnvKey("PORT")).toBe("NEMOCODE_PORT");
  });
});

describe("home directory migration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("an explicit override wins, in any spelling", () => {
    vi.stubEnv("KIMIRELAY_HOME", "/tmp/legacy-home");
    expect(nemocodeHome()).toBe("/tmp/legacy-home");
    vi.stubEnv("NEMOCODE_HOME", "/tmp/current-home");
    expect(nemocodeHome()).toBe("/tmp/current-home");
  });

  test("a fresh machine gets .nemocode", () => {
    const base = mkdtempSync(join(tmpdir(), "home-fresh-"));
    expect(nemocodeHome(base)).toBe(join(base, ".nemocode"));
  });

  test("an existing .kimirelay install keeps its keys instead of being stranded", () => {
    // The concrete regression: a user upgrading into the rebrand must not be
    // pointed at an empty .nemocode while their API keys sit in .kimirelay.
    const base = mkdtempSync(join(tmpdir(), "home-legacy-"));
    mkdirSync(join(base, ".kimirelay"));
    expect(nemocodeHome(base)).toBe(join(base, ".kimirelay"));
  });

  test(".nemocode takes over once it exists", () => {
    const base = mkdtempSync(join(tmpdir(), "home-both-"));
    mkdirSync(join(base, ".kimirelay"));
    mkdirSync(join(base, ".nemocode"));
    expect(nemocodeHome(base)).toBe(join(base, ".nemocode"));
  });
});
