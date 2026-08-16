import { describe, expect, test } from "vitest";
import { nemocodeHome, isProcessAlive } from "@nemocode/cli/dist/lib/paths.js";

describe("paths.ts - single source of truth for home + liveness (#7)", () => {
  test("nemocodeHome honors NEMOCODE_HOME env", () => {
    const original = process.env.NEMOCODE_HOME;
    process.env.NEMOCODE_HOME = "/tmp/nemocode-test-home-xyz";
    try {
      expect(nemocodeHome()).toBe("/tmp/nemocode-test-home-xyz");
    } finally {
      if (original === undefined) delete process.env.NEMOCODE_HOME;
      else process.env.NEMOCODE_HOME = original;
    }
  });

  test("nemocodeHome falls back to ~/.nemocode when env unset", () => {
    const original = process.env.NEMOCODE_HOME;
    delete process.env.NEMOCODE_HOME;
    try {
      const home = nemocodeHome();
      expect(home.endsWith("/.nemocode")).toBe(true);
    } finally {
      if (original !== undefined) process.env.NEMOCODE_HOME = original;
    }
  });

  test("isProcessAlive returns false for a dead pid (ESRCH)", () => {
    // pid 0 is never a valid kill target on unix; use a very large unused pid.
    expect(isProcessAlive(999_999_999)).toBe(false);
  });

  test("isProcessAlive returns true for the current process", () => {
    expect(isProcessAlive(process.pid)).toBe(true);
  });
});
