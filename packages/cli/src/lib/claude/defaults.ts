import {
  DEFAULT_ANTHROPIC_CAPABILITIES,
  NEMOTRON_3_5_LIGHTNING,
  getDefaultModel,
  getSelectableModels,
  resolveModelByKeys,
  type ModelDefinition,
} from "@nemocode/models";

export const CLAUDE_LOCAL_PROXY_HOST = "127.0.0.1";
export const CLAUDE_MODEL_CAPABILITIES = DEFAULT_ANTHROPIC_CAPABILITIES;

export type ClaudeModelSelection = {
  alias: string;
  definition: ModelDefinition;
};

// The Haiku tier backs Claude Code's fast background turns, so it is picked
// for throughput: Lightning runs ~5x Nano's tokens/sec at the same price.
export const CLAUDE_HAIKU_MODEL = NEMOTRON_3_5_LIGHTNING;
export const CLAUDE_HAIKU_MODEL_SELECTION: ClaudeModelSelection = {
  alias: CLAUDE_HAIKU_MODEL.anthropicAlias ?? CLAUDE_HAIKU_MODEL.id,
  definition: CLAUDE_HAIKU_MODEL,
};

/**
 * Claude-routable models = every model in the live Nebius catalog plus the
 * lightweight Haiku-tier backend Claude Code uses for built-in exploration
 * subagents. Read from the dynamic catalog so it tracks what Nebius serves.
 * Models without a friendly Anthropic alias use their Nebius id directly.
 */
export function getClaudeSupportedModels(): readonly ClaudeModelSelection[] {
  const selectable = getSelectableModels().map((definition) => ({
    alias: definition.anthropicAlias ?? definition.id,
    definition,
  }));
  const hasHaiku = selectable.some(
    (model) => model.definition.id === CLAUDE_HAIKU_MODEL_SELECTION.definition.id,
  );
  return hasHaiku ? selectable : [...selectable, CLAUDE_HAIKU_MODEL_SELECTION];
}

export function resolveClaudeModel(value: string | undefined): ClaudeModelSelection {
  const supported = getClaudeSupportedModels();
  if (supported.length === 0) {
    throw new Error("No Claude models are configured.");
  }
  const found = resolveModelByKeys(
    supported.map((model) => model.definition),
    value,
    [(model) => model.anthropicAlias, (model) => model.id],
    getDefaultModel().id,
  );
  if (!found) {
    const expected = supported
      .map(
        (model) =>
          `${model.definition.anthropicAlias ?? model.definition.id} (${model.definition.id})`,
      )
      .join(", ");
    throw new Error(`Unsupported Claude model "${value}". Expected one of: ${expected}.`);
  }
  return { alias: found.anthropicAlias ?? found.id, definition: found };
}
