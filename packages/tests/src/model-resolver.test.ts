import { describe, expect, it } from "vitest";
import {
  acceptsReasoningEffort,
  GLM_5_2,
  NEMOTRON_3_NANO,
  SELECTABLE_MODELS,
  resolveModelByKeys,
  type ModelDefinition,
} from "@nemocode/models";

// Unit tests for the shared model-selection mechanism. The per-harness
// wrappers (resolveClaudeModel / resolveCodexModel) are thin policy over this
// pure helper, and the live gauntlet never exercises `--main`, so this is the
// only place the resolution algorithm is asserted today.

describe("resolveModelByKeys", () => {
  // Claude matches by alias OR id; mirrors the key set in resolveClaudeModel.
  const aliasAndId: ReadonlyArray<(model: ModelDefinition) => string | null | undefined> = [
    (model) => model.anthropicAlias,
    (model) => model.id,
  ];
  const byId: ReadonlyArray<(model: ModelDefinition) => string | null | undefined> = [
    (model) => model.id,
  ];

  it("returns the default model when no value is given", () => {
    expect(resolveModelByKeys(SELECTABLE_MODELS, undefined, aliasAndId, GLM_5_2.id)?.id).toBe(
      GLM_5_2.id,
    );
  });

  it("returns the default model when the value is empty", () => {
    expect(resolveModelByKeys(SELECTABLE_MODELS, "", aliasAndId, GLM_5_2.id)?.id).toBe(GLM_5_2.id);
  });

  it("matches by id", () => {
    expect(
      resolveModelByKeys(SELECTABLE_MODELS, NEMOTRON_3_NANO.id, aliasAndId, GLM_5_2.id)?.id,
    ).toBe(NEMOTRON_3_NANO.id);
  });

  it("matches by alias", () => {
    expect(
      resolveModelByKeys(
        SELECTABLE_MODELS,
        GLM_5_2.anthropicAlias ?? undefined,
        aliasAndId,
        GLM_5_2.id,
      )?.id,
    ).toBe(GLM_5_2.id);
  });

  it("returns undefined when the value matches no model", () => {
    expect(
      resolveModelByKeys(SELECTABLE_MODELS, "no/such-model", aliasAndId, GLM_5_2.id),
    ).toBeUndefined();
  });

  it("falls back to the first list entry when defaultId is not in the list", () => {
    expect(resolveModelByKeys(SELECTABLE_MODELS, undefined, byId, "no/such-id")?.id).toBe(
      SELECTABLE_MODELS[0]?.id,
    );
  });

  it("returns undefined for an empty list", () => {
    expect(resolveModelByKeys([], undefined, byId, GLM_5_2.id)).toBeUndefined();
  });
});

describe("reasoning_effort routing", () => {
  // Verified against live Nebius 2026-08-17. These are not style preferences:
  // this proxy's default effort is "none", so sending the parameter to a model
  // whose enum omits "none" 400s the entire request.
  test("only sends reasoning_effort to models that accept this proxy's values", () => {
    expect(acceptsReasoningEffort("nvidia/Nemotron-3-Ultra-550b-a55b")).toBe(true);

    // super-120b accepts reasoning_effort but only low/medium/high. It is also
    // the header-timeout failover target, so sending it an effort broke the
    // rescue path, not just direct selection.
    expect(acceptsReasoningEffort("nvidia/nemotron-3-super-120b-a12b")).toBe(false);

    // The Haiku tier has always been sent no effort; keep it that way.
    expect(acceptsReasoningEffort("nvidia/Nemotron-3_5-Lightning")).toBe(false);
  });
});
