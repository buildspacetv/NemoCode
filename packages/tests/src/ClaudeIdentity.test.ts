import { describe, expect, test } from "vitest";
import { toOpenAIMessages } from "../../cli/src/lib/claude/translate-request.js";
import type { ModelDefinition } from "@kimirelay/models";

const NEMOTRON = {
  id: "nvidia/Llama-3_1-Nemotron-Ultra-253B-v1",
  name: "Nemotron Ultra 253B",
} as ModelDefinition;

function systemContent(messages: ReturnType<typeof toOpenAIMessages>): string {
  const first = messages[0];
  if (first?.role !== "system" || typeof first.content !== "string") {
    throw new Error("expected a leading system message");
  }
  return first.content;
}

describe("claude model-identity prompt", () => {
  test("names the backend model and says how to answer identity questions", () => {
    const content = systemContent(
      toOpenAIMessages({ messages: [{ role: "user", content: "what model are you?" }] }, NEMOTRON),
    );
    expect(content).toContain(
      "you are Nemotron Ultra 253B (nvidia/Llama-3_1-Nemotron-Ultra-253B-v1)",
    );
    expect(content).toContain('answer "Nemotron Ultra 253B"');
    expect(content).toContain("never claim to be another vendor's model");
  });

  test("falls back to a generic affirmative identity without a target model", () => {
    const content = systemContent(
      toOpenAIMessages({ messages: [{ role: "user", content: "hi" }] }),
    );
    expect(content).toContain("Model identity:");
    expect(content).toContain("name your backend model");
  });

  test("mentions the ephemeral Tavily MCP server only when the launcher injected it", () => {
    const withInject = systemContent(
      toOpenAIMessages({ messages: [{ role: "user", content: "is tavily set up?" }] }, NEMOTRON, {
        tavilyMcpInjected: true,
      }),
    );
    expect(withInject).toContain("ephemeral Tavily MCP server");
    expect(withInject).toContain("does not appear in `claude mcp list`");

    const withoutInject = systemContent(
      toOpenAIMessages({ messages: [{ role: "user", content: "hi" }] }, NEMOTRON),
    );
    expect(withoutInject).not.toContain("Tavily MCP");
  });

  test("keeps the harness system prompt after the identity line", () => {
    const content = systemContent(
      toOpenAIMessages(
        {
          system: "You are Claude Code, Anthropic's official CLI.",
          messages: [{ role: "user", content: "hi" }],
        },
        NEMOTRON,
      ),
    );
    expect(content.indexOf("Model identity:")).toBe(0);
    expect(content).toContain("You are Claude Code");
  });
});
