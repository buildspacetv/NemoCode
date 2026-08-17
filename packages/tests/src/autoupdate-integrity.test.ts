import { describe, expect, test } from "vitest";
import { resolveBundleUrl, sha256Hex } from "../../cli/src/lib/autoupdate.js";

/**
 * The self-updater writes a file that every later `klaude`/`kodex` run
 * executes, so these two gates are the whole security story for the update
 * path: the bundle must come from the manifest's own origin, and it must hash
 * to the digest the manifest published.
 */
describe("update bundle URL origin pinning", () => {
  const manifestUrl = "https://nemocode.org/latest.json";

  test("accepts an absolute url on the manifest's origin", () => {
    expect(
      resolveBundleUrl({ version: "1.0.0", url: "https://nemocode.org/x.js" }, manifestUrl),
    ).toBe("https://nemocode.org/x.js");
  });

  test("accepts a relative url and resolves it against the manifest", () => {
    expect(resolveBundleUrl({ version: "1.0.0", url: "/build/x.js" }, manifestUrl)).toBe(
      "https://nemocode.org/build/x.js",
    );
  });

  test("defaults to the standard bundle path when the manifest omits url", () => {
    expect(resolveBundleUrl({ version: "1.0.0" }, manifestUrl)).toBe(
      "https://nemocode.org/kimirelay.js",
    );
  });

  test("refuses a url pointing at a different host", () => {
    expect(() =>
      resolveBundleUrl({ version: "1.0.0", url: "https://evil.example/payload.js" }, manifestUrl),
    ).toThrow(/origin/);
  });

  test("refuses a downgrade to plaintext on the same host", () => {
    expect(() =>
      resolveBundleUrl({ version: "1.0.0", url: "http://nemocode.org/x.js" }, manifestUrl),
    ).toThrow(/origin/);
  });

  test("honors a local mirror's own origin rather than the hardcoded one", () => {
    // NEMORELAY_MANIFEST_URL stays useful: a mirror can serve a
    // self-consistent manifest + bundle pair, but only from its own host.
    const mirror = "http://127.0.0.1:8080/latest.json";
    expect(resolveBundleUrl({ version: "1.0.0", url: "/kimirelay.js" }, mirror)).toBe(
      "http://127.0.0.1:8080/kimirelay.js",
    );
    expect(() =>
      resolveBundleUrl({ version: "1.0.0", url: "https://nemocode.org/x.js" }, mirror),
    ).toThrow(/origin/);
  });
});

describe("bundle digest", () => {
  test("matches the well-known sha256 of the empty input", () => {
    expect(sha256Hex(new Uint8Array())).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  test("changes when a single byte changes", () => {
    const a = sha256Hex(new TextEncoder().encode("console.log(1)"));
    const b = sha256Hex(new TextEncoder().encode("console.log(2)"));
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});
