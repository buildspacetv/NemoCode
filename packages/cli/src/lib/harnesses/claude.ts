import { resolveClaudeModel } from "../claude/defaults.js";
import { HARNESS } from "../harness.js";
import { defineHarness } from "../harness-types.js";
import { resolveRelayCredentials } from "../credentials.js";
import { claudeRunsInBackground, runClaudeNebius } from "../claude/core.js";
import {
  cleanupTavilyMcpConfig,
  shouldInjectTavilyMcp,
  writeTavilyMcpConfig,
} from "../claude/tavily-mcp.js";
import { readAgentModelPreference, recordAgentModel } from "../model-preferences.js";

/** Resolve a Claude model, falling back to the default if the value is invalid. */
function resolveClaudeModelSafe(value: string | undefined) {
  try {
    return resolveClaudeModel(value);
  } catch {
    return resolveClaudeModel(undefined);
  }
}

export default defineHarness({
  id: HARNESS.CLAUDE,
  label: "Claude Code",

  async run(ctx) {
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

    // Model precedence: explicit --model/--main wins and is remembered;
    // otherwise the last model used (persisted by the daemon on /model changes),
    // then the default. A stale/invalid stored id safely falls back.
    const requested = ctx.main ?? (await readAgentModelPreference("claude"));
    const selectedModel = resolveClaudeModelSafe(requested);
    if (ctx.main) {
      await recordAgentModel("claude", selectedModel.definition.id);
    }
    // Tavily MCP auto-inject: when a Tavily key is configured, hand the
    // session Tavily's remote MCP server via an ephemeral --mcp-config (see
    // claude/tavily-mcp.ts for the skip conditions and key handling).
    const passthrough = ctx.passthrough ?? [];
    const tavilyKey = process.env.TAVILY_API_KEY?.trim();
    const tavilyMcp =
      tavilyKey && shouldInjectTavilyMcp(passthrough, process.env)
        ? writeTavilyMcpConfig(tavilyKey)
        : undefined;
    const args = tavilyMcp ? [...passthrough, "--mcp-config", tavilyMcp.path] : passthrough;

    const launchOptions = {
      apiKey,
      baseUrl: credentials.baseUrl,
      modelId: selectedModel.alias,
      ...(args.length > 0 ? { args } : {}),
      ...(tavilyMcp ? { tavilyMcpInjected: true } : {}),
    };
    try {
      const result = await runClaudeNebius(launchOptions);
      if (typeof result.status === "number") {
        process.exitCode = result.status;
      }
    } finally {
      // In --bg mode Claude Code outlives the foreground process; leave the
      // config file for the detached worker (tmpdir cleanup owns it then).
      if (tavilyMcp && !claudeRunsInBackground(args)) {
        cleanupTavilyMcpConfig(tavilyMcp.dir);
      }
    }
    return {};
  },
});
