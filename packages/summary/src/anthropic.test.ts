import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import {
  ANTHROPIC_PROMPT_VERSION,
  AnthropicSummaryProvider,
  DEFAULT_SUMMARY_MODEL,
} from "./anthropic.js";
import { SummaryGenerationError } from "./types.js";

const request = {
  unit: {
    title: "가상 메모리",
    content: "가상 메모리는 물리 메모리보다 큰 주소 공간을 제공한다. 페이지 단위로 관리된다.",
  },
} as const;

function fakeClient(response: unknown): { client: Anthropic; create: ReturnType<typeof vi.fn> } {
  const create = vi.fn().mockResolvedValue(response);
  return { client: { messages: { create } } as unknown as Anthropic, create };
}

function successResponse(overrides: Record<string, unknown> = {}) {
  return {
    model: "claude-opus-4-8",
    stop_reason: "end_turn",
    content: [
      {
        type: "text",
        text: JSON.stringify({
          evidence_sufficient: true,
          short_summary: "가상 메모리는 물리 메모리보다 큰 주소 공간을 제공하는 기법이다.",
          key_concepts: ["가상 메모리", "페이지"],
          confusion_points: ["가상 메모리와 물리 메모리의 크기 관계"],
        }),
      },
    ],
    usage: { input_tokens: 321, output_tokens: 87 },
    ...overrides,
  };
}

describe("AnthropicSummaryProvider", () => {
  it("maps a structured response onto a summary card with provenance", async () => {
    const { client, create } = fakeClient(successResponse());
    const provider = new AnthropicSummaryProvider({ client });

    const card = await provider.generateSummary(request);

    expect(card.shortSummary).toContain("가상 메모리");
    expect(card.keyConcepts).toEqual(["가상 메모리", "페이지"]);
    expect(card.generation).toMatchObject({
      provider: "anthropic",
      model: "claude-opus-4-8",
      promptVersion: ANTHROPIC_PROMPT_VERSION,
      inputTokens: 321,
      outputTokens: 87,
    });
    expect(card.generation.inputSha256).toMatch(/^[0-9a-f]{64}$/);

    // Request shape: current model, adaptive thinking, structured output.
    const params = create.mock.calls[0]?.[0];
    expect(params.model).toBe(DEFAULT_SUMMARY_MODEL);
    expect(params.thinking).toEqual({ type: "adaptive" });
    expect(params.output_config.format.type).toBe("json_schema");
    // The source content must be wrapped as untrusted data.
    expect(params.messages[0].content).toContain("<자료>");
  });

  it("fails closed when the model reports insufficient evidence", async () => {
    const { client } = fakeClient(
      successResponse({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              evidence_sufficient: false,
              short_summary: "",
              key_concepts: [],
              confusion_points: [],
            }),
          },
        ],
      }),
    );
    const provider = new AnthropicSummaryProvider({ client });
    await expect(provider.generateSummary(request)).rejects.toThrow(/insufficient evidence/);
  });

  it("fails closed on a refusal stop reason", async () => {
    const { client } = fakeClient(successResponse({ stop_reason: "refusal", content: [] }));
    const provider = new AnthropicSummaryProvider({ client });
    await expect(provider.generateSummary(request)).rejects.toThrow(/refused/);
  });

  it("fails closed on truncated output", async () => {
    const { client } = fakeClient(successResponse({ stop_reason: "max_tokens" }));
    const provider = new AnthropicSummaryProvider({ client });
    await expect(provider.generateSummary(request)).rejects.toThrow(/truncated/);
  });

  it("fails closed on non-JSON output", async () => {
    const { client } = fakeClient(
      successResponse({ content: [{ type: "text", text: "요약: 이건 JSON이 아님" }] }),
    );
    const provider = new AnthropicSummaryProvider({ client });
    await expect(provider.generateSummary(request)).rejects.toThrow(SummaryGenerationError);
  });

  it("fails closed when the generated card violates output bounds", async () => {
    const { client } = fakeClient(
      successResponse({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              evidence_sufficient: true,
              short_summary: "요약",
              key_concepts: [], // empty — violates 1..10
              confusion_points: [],
            }),
          },
        ],
      }),
    );
    const provider = new AnthropicSummaryProvider({ client });
    await expect(provider.generateSummary(request)).rejects.toThrow(/keyConcepts/);
  });
});
