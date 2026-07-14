import { describe, expect, it } from "vitest";
import { resolveQuotesToCitations } from "./citations.js";
import { gradeShortAnswer, normalizeAnswer } from "./grading.js";
import { MockQuizProvider } from "./mock.js";
import { QuizGenerationError, QuizValidationError } from "./types.js";

const provider = new MockQuizProvider();

const unit = {
  title: "운영체제 3장",
  content:
    "프로세스는 실행 중인 프로그램이다. 스레드는 프로세스 내부의 실행 단위이다. 가상 메모리는 물리 메모리보다 큰 주소 공간을 제공한다.",
} as const;

describe("resolveQuotesToCitations", () => {
  it("anchors verbatim quotes to exact offsets", () => {
    const [citation] = resolveQuotesToCitations(
      ["스레드는 프로세스 내부의 실행 단위이다."],
      unit.content,
    );
    expect(unit.content.slice(citation?.start ?? 0, citation?.end ?? 0)).toBe(citation?.quote);
  });

  it("fails closed on paraphrased (non-verbatim) quotes", () => {
    expect(() => resolveQuotesToCitations(["스레드는 실행의 단위다"], unit.content)).toThrow(
      QuizGenerationError,
    );
  });

  it("fails closed on empty quotes", () => {
    expect(() => resolveQuotesToCitations([""], unit.content)).toThrow(QuizGenerationError);
    expect(() => resolveQuotesToCitations([], unit.content)).toThrow(QuizGenerationError);
  });
});

describe("MockQuizProvider", () => {
  it("generates short-answer items whose citations resolve verbatim", async () => {
    const result = await provider.generateQuiz({ unit, quizType: "short-answer", count: 3 });

    expect(result.items).toHaveLength(3);
    for (const item of result.items) {
      expect(item.citations.length).toBeGreaterThan(0);
      for (const citation of item.citations) {
        expect(unit.content.slice(citation.start, citation.end)).toBe(citation.quote);
      }
      expect(item.answer.length).toBeGreaterThan(0);
      expect(item.choices).toBeUndefined();
    }
    expect(result.generation.provider).toBe("mock");
    expect(result.generation.inputSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates valid multiple-choice items (3-5 choices, exactly one correct)", async () => {
    const result = await provider.generateQuiz({ unit, quizType: "multiple-choice", count: 2 });
    for (const item of result.items) {
      const choices = item.choices ?? [];
      expect(choices.length).toBeGreaterThanOrEqual(3);
      expect(choices.length).toBeLessThanOrEqual(5);
      expect(choices.filter((c) => c.isCorrect)).toHaveLength(1);
      expect(choices.find((c) => c.isCorrect)?.content).toBe(item.answer);
    }
  });

  it("generates fill-in-the-blank prompts containing the blank marker", async () => {
    const result = await provider.generateQuiz({ unit, quizType: "fill-in-the-blank", count: 2 });
    for (const item of result.items) {
      expect(item.prompt).toContain("____");
    }
  });

  it("is deterministic", async () => {
    const a = await provider.generateQuiz({ unit, quizType: "multiple-choice", count: 3 });
    const b = await provider.generateQuiz({ unit, quizType: "multiple-choice", count: 3 });
    expect(a).toEqual(b);
  });

  it("rejects invalid counts and too-short content", async () => {
    await expect(
      provider.generateQuiz({ unit, quizType: "short-answer", count: 0 }),
    ).rejects.toThrow(QuizValidationError);
    await expect(
      provider.generateQuiz({ unit, quizType: "short-answer", count: 11 }),
    ).rejects.toThrow(QuizValidationError);
    await expect(
      provider.generateQuiz({
        unit: { title: "t", content: "짧다" },
        quizType: "short-answer",
        count: 1,
      }),
    ).rejects.toThrow(/too short/);
  });
});

describe("gradeShortAnswer (Korean-aware normalization)", () => {
  const item = { answer: "가상 메모리", acceptedAnswers: ["가상메모리", "virtual memory"] };

  it("accepts exact and accepted-answer matches", () => {
    expect(gradeShortAnswer(item, "가상 메모리").isCorrect).toBe(true);
    expect(gradeShortAnswer(item, "가상메모리").isCorrect).toBe(true);
    expect(gradeShortAnswer(item, "Virtual Memory").isCorrect).toBe(true);
  });

  it("normalizes whitespace, trailing punctuation, and NFC composition", () => {
    expect(gradeShortAnswer(item, "  가상   메모리.  ").isCorrect).toBe(true);
    // NFD (decomposed) Hangul must match its NFC (composed) form.
    expect(gradeShortAnswer(item, "가상 메모리".normalize("NFD")).isCorrect).toBe(true);
    expect(normalizeAnswer("가상 메모리".normalize("NFD"))).toBe(normalizeAnswer("가상 메모리"));
  });

  it("rejects wrong and empty answers", () => {
    expect(gradeShortAnswer(item, "물리 메모리").isCorrect).toBe(false);
    expect(gradeShortAnswer(item, "   ").isCorrect).toBe(false);
  });

  it("reports the grading method for the raw Attempt record", () => {
    expect(gradeShortAnswer(item, "가상 메모리").gradingMethod).toBe("normalized_match");
  });
});
