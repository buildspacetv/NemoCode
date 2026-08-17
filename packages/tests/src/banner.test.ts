import { afterEach, describe, expect, test, vi } from "vitest";
import { renderLaunchBanner, supportsColor } from "../../cli/src/lib/banner.js";

const ESC = "";

describe("launch banner", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("prints the mascot beside the supplied lines", () => {
    const out = renderLaunchBanner({ color: false, lines: ["NemoCode", "Claude Code → Nebius"] });
    const rows = out.trimEnd().split("\n");

    // Five mascot rows survive even though only two text lines were given.
    expect(rows).toHaveLength(5);
    expect(rows[0]).toContain("NemoCode");
    expect(rows[1]).toContain("Claude Code → Nebius");
    expect(out.endsWith("\n")).toBe(true);
  });

  test("emits no escape sequences when colour is off", () => {
    const out = renderLaunchBanner({ color: false, lines: ["NemoCode"] });
    expect(out).not.toContain(ESC);
  });

  test("colours the mascot when colour is on", () => {
    const out = renderLaunchBanner({ color: true, lines: ["NemoCode"] });
    expect(out).toContain(`${ESC}[38;2;198;241;53m`);
  });

  test("keeps lines that run past the mascot instead of dropping them", () => {
    // A caller must never lose a message by adding one line too many - the
    // Tavily notice is the fourth line on harnesses that inject it.
    const lines = ["one", "two", "three", "four", "five", "six", "seven"];
    const out = renderLaunchBanner({ color: false, lines });
    for (const line of lines) {
      expect(out).toContain(line);
    }
    expect(out.trimEnd().split("\n")).toHaveLength(7);
  });

  test("NO_COLOR disables colour even on a TTY", () => {
    vi.stubEnv("NO_COLOR", "1");
    expect(supportsColor({ isTTY: true })).toBe(false);
  });

  test("a redirected stream gets no colour", () => {
    vi.stubEnv("NO_COLOR", "");
    expect(supportsColor({ isTTY: false })).toBe(false);
    expect(supportsColor({ isTTY: true })).toBe(true);
  });
});
