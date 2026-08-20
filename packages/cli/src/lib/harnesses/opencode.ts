import { relayEnv } from "../env.js";
import { spawn } from "node:child_process";
import { OPENCODE_DEFAULT_MODEL, OPENCODE_PROVIDER_ID } from "../opencode/defaults.js";
import { buildOpencodeConfigJson, buildOpencodeEnv } from "../opencode/core.js";
import { resolveRelayCredentials, upstreamLabel } from "../credentials.js";
import { resolveTavilyMcpKey } from "../tavily-mcp-key.js";
import { defineHarness } from "../harness-types.js";
import { HARNESS } from "../harness.js";
import type { HarnessContext, HarnessResult } from "../harness-types.js";
import { renderLaunchBanner } from "../banner.js";

/**
 * Strips any `--model`/`-m`/`--model=` from passthrough args so a user can't
 * override the Nebius default. Parallel to Claude's
 * `claudeArgsWithoutModelOverrides`.
 */
function opencodeArgsWithoutModelOverrides(args: string[]): string[] {
  const sanitized: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === undefined) {
      continue;
    }
    if (arg === "--model" || arg === "-m") {
      i += 1;
      continue;
    }
    if (arg.startsWith("--model=")) {
      continue;
    }
    sanitized.push(arg);
  }
  return sanitized;
}

export default defineHarness({
  id: HARNESS.OPENCODE,
  label: "OpenCode",

  async run(ctx: HarnessContext): Promise<HarnessResult> {
    const credentials = await resolveRelayCredentials({
      apiKey: ctx.apiKey,
      home: ctx.home,
    });
    const apiKey = credentials.apiKey;
    if (!apiKey) {
      throw new Error(
        "No inference credentials found. Run `nemo configure` to pick demo mode or add a key, or pass --api-key / set NEBIUS_API_KEY.",
      );
    }

    const modelId = ctx.main ?? OPENCODE_DEFAULT_MODEL;
    // Tavily MCP auto-inject: OpenCode talks straight to Nebius (no relay
    // proxy, no emulated web_search), so the injected Tavily server is its
    // only live-web path. Config-only; the key resolves from the environment.
    const tavilyMcp = Boolean(resolveTavilyMcpKey());
    const configJson = buildOpencodeConfigJson({ modelId, tavilyMcp });
    const env = buildOpencodeEnv({ apiKey, configJson });
    process.stderr.write(
      renderLaunchBanner({
        lines: ["NemoCode", `OpenCode → ${upstreamLabel(credentials.baseUrl)}`, modelId],
      }),
    );
    if (tavilyMcp) {
      process.stderr.write(
        "NemoCode ▸ Tavily MCP injected for this session (ephemeral - config is never written to disk).\n",
      );
    }

    if (relayEnv("DEBUG") === "1") {
      process.stderr.write(`[nemo opencode] custom model: ${modelId}\n`);
      process.stderr.write(`[nemo opencode] config: ${JSON.stringify(configJson)}\n`);
    }

    // Force our model via the CLI flag (highest precedence). Relying on the
    // injected config's `model` field alone is not enough: OpenCode merges the
    // user's own global config (~/.config/opencode), whose `model` default
    // otherwise wins and routes to the wrong provider. `-m provider/model` on
    // the CLI overrides that for both the TUI and `run`.
    const modelSelector = `${OPENCODE_PROVIDER_ID}/${modelId}`;
    const opencodeArgs = [
      "--model",
      modelSelector,
      ...opencodeArgsWithoutModelOverrides(ctx.passthrough ?? []),
    ];

    const child = spawn("opencode", opencodeArgs, {
      env,
      stdio: "inherit",
    });

    const result = await new Promise<{ status: number | null; signal: NodeJS.Signals | null }>(
      (resolve, reject) => {
        child.on("error", reject);
        child.on("exit", (status, signal) => resolve({ status, signal }));
      },
    );

    if (typeof result.status === "number") {
      process.exitCode = result.status;
    }
    return {};
  },
});
