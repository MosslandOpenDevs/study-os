import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import {
  ANTHROPIC_QUIZ_PROMPT_VERSION,
  AnthropicQuizProvider,
  DEFAULT_QUIZ_MODEL,
} from "./anthropic.js";
import { QuizGenerationError } from "./types.js";

const unit = {
  title: "가상 메모리",
  content: "가상 메모리는 물리 메모리보다 큰 주소 공간을 제공한다. 페이지 단위로 관리된다.",
} as const;

const request = { unit, quizType: "short-answer", count: 1 } as const;

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
          items: [
            {
              prompt: "가상 메모리가 제공하는 것은 무엇인가?",
              answer: "물리 메모리보다 큰 주소 공간",
              accepted_answers: ["더 큰 주소 공간"],
              explanation: "자료에 따르면 가상 메모리는 더 큰 주소 공간을 제공한다.",
              difficulty: 2,
              evidence_quotes: ["가상 메모리는 물리 메모리보다 큰 주소 공간을 제공한다."],
              choices: [],
            },
          ],
        }),
      },
    ],
    usage: { input_tokens: 500, output_tokens: 200 },
    ...overrides,
  };
}

describe("AnthropicQuizProvider", () => {
  it("resolves evidence quotes to verified offsets and carries provenance", async () => {
    const { client, create } = fakeClient(successResponse());
    const provider = new AnthropicQuizProvider({ client });

    const result = await provider.generateQuiz(request);

    const [item] = result.items;
    expect(item?.citations).toHaveLength(1);
    const citation = item?.citations[0];
    expect(unit.content.slice(citation?.start ?? 0, citation?.end ?? 0)).toBe(citation?.quote);

    expect(result.generation).toMatchObject({
      provider: "anthropic",
      model: "claude-opus-4-8",
      promptVersion: ANTHROPIC_QUIZ_PROMPT_VERSION,
      inputTokens: 500,
      outputTokens: 200,
    });

    const params = create.mock.calls[0]?.[0];
    expect(params.model).toBe(DEFAULT_QUIZ_MODEL);
    expect(params.thinking).toEqual({ type: "adaptive" });
    expect(params.output_config.format.type).toBe("json_schema");
    expect(params.messages[0].content).toContain("<자료>");
  });

  it("fails closed when a quote is not verbatim in the source", async () => {
    const body = JSON.parse(successResponse().content[0]?.text ?? "{}");
    body.items[0].evidence_quotes = ["가상 메모리는 주소 공간을 늘려준다"]; // paraphrased
    const { client } = fakeClient(
      successResponse({ content: [{ type: "text", text: JSON.stringify(body) }] }),
    );
    const provider = new AnthropicQuizProvider({ client });
    await expect(provider.generateQuiz(request)).rejects.toThrow(/not found verbatim/);
  });

  it("fails closed when the model reports insufficient evidence", async () => {
    const { client } = fakeClient(
      successResponse({
        content: [
          { type: "text", text: JSON.stringify({ evidence_sufficient: false, items: [] }) },
        ],
      }),
    );
    const provider = new AnthropicQuizProvider({ client });
    await expect(provider.generateQuiz(request)).rejects.toThrow(/insufficient evidence/);
  });

  it("fails closed on refusal and truncation", async () => {
    for (const stop_reason of ["refusal", "max_tokens"]) {
      const { client } = fakeClient(successResponse({ stop_reason }));
      const provider = new AnthropicQuizProvider({ client });
      await expect(provider.generateQuiz(request)).rejects.toThrow(QuizGenerationError);
    }
  });

  it("fails closed when an MCQ batch violates the choice contract", async () => {
    const body = JSON.parse(successResponse().content[0]?.text ?? "{}");
    body.items[0].choices = [
      { label: "가", content: "A", is_correct: true },
      { label: "나", content: "B", is_correct: true }, // two correct — invalid
      { label: "다", content: "C", is_correct: false },
    ];
    const { client } = fakeClient(
      successResponse({ content: [{ type: "text", text: JSON.stringify(body) }] }),
    );
    const provider = new AnthropicQuizProvider({ client });
    await expect(
      provider.generateQuiz({ unit, quizType: "multiple-choice", count: 1 }),
    ).rejects.toThrow(/exactly one choice/);
  });
});
