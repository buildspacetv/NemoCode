import os from "node:os";
import * as clack from "@clack/prompts";
import { ALL_HARNESSES, HARNESS_LABEL, type HarnessId } from "../harness.js";
import { isHarnessImplemented } from "../harness-registry.js";
import { detectInstalledHarnesses } from "../detect.js";
import {
  readGlobalConfig,
  setGlobalApiKey,
  resolveStoredApiKey,
  resolveStoredTavilyApiKey,
  setGlobalTavilyApiKey,
  setGlobalMode,
} from "../global-config.js";
import { resolveNebiusBaseUrl } from "../nebius-core.js";
import { ANONYMOUS_DEMO_TOKEN, resolveDemoBaseUrl } from "../credentials.js";
import { VERSION } from "../version.js";

export type NebiusKeyCheck = "valid" | "invalid" | "unreachable";

/**
 * Live-check a Nebius key against the models endpoint. Only a definitive
 * 401/403 marks it invalid - server errors and network failures return
 * "unreachable" so configure never blocks or discards a key it cannot judge.
 */
export async function checkNebiusKey(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<NebiusKeyCheck> {
  try {
    const res = await fetchImpl(`${resolveNebiusBaseUrl()}/models`, {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      return "valid";
    }
    if (res.status === 401 || res.status === 403) {
      return "invalid";
    }
    return "unreachable";
  } catch {
    return "unreachable";
  }
}

/**
 * Probe the demo endpoint the same way BYOK probes a key: a definitive
 * rejection is worth surfacing at configure time rather than at first use,
 * where it would look like a broken install. Anything inconclusive is left
 * alone - configure never blocks on a check it cannot judge.
 */
export async function checkDemoEndpoint(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<"reachable" | "unavailable"> {
  try {
    const res = await fetchImpl(`${baseUrl}/models`, {
      headers: { authorization: `Bearer ${ANONYMOUS_DEMO_TOKEN}` },
    });
    // 401/403 still proves something is serving the route; only a missing or
    // broken endpoint counts as unavailable.
    return res.status === 404 || res.status >= 500 ? "unavailable" : "reachable";
  } catch {
    return "unavailable";
  }
}

export function printHelp() {
  console.log(`nemocode v${VERSION} - Nebius Token Factory for coding CLIs

Usage:
  nemo configure
  nemo whoami
  nemo chatgpt [--model <model>] [--restore]  (alpha)
  nemo codex [...]       (alias: codemo)
  nemo claude [...]      (alias: claudemo)
  nemo pi [...]          (alias: pimo)
  nemo opencode [...]    (alias: opencodemo)
  nemo sandbox status|project|run|fetch|prebake|advisory
                              Cloud sandboxes - tenki.cloud by default (set TENKI_API_KEY);
                              Nebius Token Factory Sandboxes via --provider contree (gated beta)

Extra args after codex/claude/pi/opencode are passed through.

Sandbox sessions (default provider: tenki.cloud - open signup, set TENKI_API_KEY;
Nebius Token Factory with --provider contree needs Sandboxes beta access):
  claudemo --sandbox -p "<task>"    Claude Code on Nemotron in a disposable microVM,
                                  against your repo's pushed state. Headless only.
  codemo --sandbox exec "<task>"   Same for Codex.
ChatGPT App support is alpha; run \`nemo chatgpt --restore\` (alias: codex-app) to restore the previous desktop config.

Codex flags:
  --no-mcp   Skip your ~/.codex/config.toml MCP servers for a fast startup
             (maps to codex --ignore-user-config; also skips other codex config).

Your last-used model is remembered per tool: change it with /model (or --model
before the harness) and the next launch reuses it.

Docs: https://nemocode.org/llms.txt
  LLM-readable documentation - if you are an AI agent asked to install, configure,
  or use nemocode (including headless use), read that file first.
`);
}

export async function runConfigure(
  home = os.homedir(),
  checkKey: (apiKey: string) => Promise<NebiusKeyCheck> = checkNebiusKey,
  checkDemo: (baseUrl: string) => Promise<"reachable" | "unavailable"> = checkDemoEndpoint,
): Promise<boolean> {
  clack.intro("nemo configure");

  const detected = detectInstalledHarnesses();
  const notImplemented = ALL_HARNESSES.filter((h) => !isHarnessImplemented(h));

  const lines = ALL_HARNESSES.map((h) => {
    const found = detected[h].installed ? "found" : "not found";
    const support = isHarnessImplemented(h) ? " (ephemeral settings)" : " (support coming later)";
    return `  ${HARNESS_LABEL[h]}: ${found}${support}`;
  });
  clack.log.info(`Detected tools:\n${lines.join("\n")}`);

  // Mode first: demo has no key to validate, so asking for one before knowing
  // the mode would make the no-key path go through a prompt that exists only
  // for the other one.
  const stored = await readGlobalConfig(home);
  // Only ask when there is a terminal to answer with. A piped or scripted
  // `nemo configure` (and the test-suite) cannot respond to a select, so it
  // keeps whatever mode is already stored - which for every pre-demo install
  // is byok, leaving their flow exactly as it was.
  const chosenMode = !process.stdin.isTTY
    ? stored.mode
    : await clack.select({
        message: "How should NemoCode reach a model?",
        initialValue: stored.mode,
        options: [
          {
            value: "demo" as const,
            label: "Demo - no key needed",
            hint: "runs through a rate-limited endpoint we host; good for trying it out",
          },
          {
            value: "byok" as const,
            label: "Use my own Nebius key",
            hint: "full speed, your own quota and billing",
          },
        ],
      });
  if (clack.isCancel(chosenMode)) {
    clack.cancel("Cancelled.");
    return false;
  }

  await setGlobalMode(home, chosenMode);

  if (chosenMode === "demo") {
    clack.log.success(
      "Demo mode. Sessions run against a shared, rate-limited endpoint - no key stored.",
    );
    const demoBaseUrl = resolveDemoBaseUrl();
    if ((await checkDemo(demoBaseUrl)) === "unavailable") {
      clack.log.warn(
        `The demo endpoint (${demoBaseUrl}) is not answering yet. Sessions will fail until it is up - ` +
          "use your own key with `nemo configure` if you need to work now.",
      );
    }
    clack.log.info("Switch to your own key any time with `nemo configure`.");
  }

  // Only BYOK needs a provider key. Tavily below is deliberately outside this
  // branch: it powers web_search emulation, which is independent of which
  // upstream serves inference, so demo users can configure it too.
  let apiKey = "";
  if (chosenMode === "byok") {
    const existing = resolveStoredApiKey(stored.apiKey);
    apiKey = existing || process.env.NEBIUS_API_KEY || "";
    // Live-check an existing key so a rotated/revoked one re-opens the prompt -
    // without this, configure silently keeps a dead stored key forever (the
    // stored key beats the environment, so even a fresh export can't fix it).
    if (apiKey) {
      const check = await checkKey(apiKey);
      if (check === "invalid") {
        clack.log.warn(
          "Your existing Nebius key was rejected by the API (unauthorized) - it may have been rotated or revoked. Enter a new one.",
        );
        apiKey = "";
      } else if (check === "valid") {
        clack.log.success("Nebius key: valid.");
      } else {
        clack.log.warn("Could not reach Nebius to verify the existing key - keeping it.");
      }
    }
    while (!apiKey) {
      const entered = await clack.password({
        message: "Nebius API key (from https://tokenfactory.nebius.com/?modals=create-api-key):",
        validate: (value) => (value.trim() ? undefined : "An API key is required"),
      });
      if (clack.isCancel(entered)) {
        clack.cancel("Cancelled.");
        return false;
      }
      const candidate = entered.trim();
      const check = await checkKey(candidate);
      if (check === "invalid") {
        clack.log.warn("That key was rejected by Nebius (unauthorized) - check it and try again.");
        continue;
      }
      if (check === "valid") {
        clack.log.success("Nebius key: valid.");
      } else {
        clack.log.warn("Could not reach Nebius to verify the key - storing it anyway.");
      }
      apiKey = candidate;
    }
    await setGlobalApiKey(home, apiKey);
  }

  // Tavily powers the proxy's native web_search emulation for Claude Code and
  // Codex. It's optional - without it, searches return a clear "TAVILY_API_KEY
  // not set" error rather than failing silently - so allow skipping.
  const existingTavily = resolveStoredTavilyApiKey((await readGlobalConfig(home)).tavilyApiKey);
  let tavilyApiKey = existingTavily || process.env.TAVILY_API_KEY || "";
  if (!tavilyApiKey) {
    const enteredTavily = await clack.password({
      message:
        "Tavily API key - OPTIONAL, press Enter to skip (recommended: unlocks live web search + Tavily tools; free key at https://app.tavily.com):",
      validate: (value) => (value.trim() || value === "" ? undefined : undefined),
    });
    if (clack.isCancel(enteredTavily)) {
      clack.cancel("Cancelled.");
      return false;
    }
    tavilyApiKey = enteredTavily.trim();
  }
  // `configure` is the explicit persistent-credential flow. Store the resolved
  // Tavily key just like the Nebius key above so it survives a cold start even
  // when the current shell's TAVILY_API_KEY does not. (This fixes the papercut
  // where a daemon started before configure kept failing web search.)
  await setGlobalTavilyApiKey(home, tavilyApiKey);
  if (tavilyApiKey) {
    clack.log.success("Tavily web search enabled.");
  } else {
    clack.log.info(
      "Tavily key skipped - agents run fine without it, just with no live web search. Add one anytime with `nemo configure`.",
    );
  }

  const launchable = ALL_HARNESSES.filter(
    (h) => isHarnessImplemented(h) && detected[h as HarnessId].installed,
  );
  if (launchable.length > 0) {
    clack.log.info(
      `Ready to launch: ${launchable
        .map((h) => HARNESS_LABEL[h])
        .join(", ")}. Run \`nemo <harness>\` to start - nothing is written to disk.`,
    );
  }

  if (notImplemented.length > 0) {
    clack.log.info(
      `${notImplemented.map((h) => HARNESS_LABEL[h]).join(" and ")} support is coming in a later phase (needs a local translation proxy).`,
    );
  }

  clack.outro("Done.");
  return true;
}
