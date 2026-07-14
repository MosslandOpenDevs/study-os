import { sha256Hex } from "./hash.js";
import type { SummaryCardDraft, SummaryProvider, SummaryRequest, TonePreset } from "./types.js";
import { validateSummaryCard, validateSummaryRequest } from "./validate.js";

export const MOCK_PROMPT_VERSION = "ko-summary-mock-v1";

const TONE_PREFIX: Record<TonePreset, string> = {
  teacher: "핵심을 차근차근 정리하면,",
  tutor: "같이 살펴보면,",
  "concise-exam": "시험 대비 요점:",
};

/**
 * Deterministic, offline SummaryProvider for development and tests.
 * Derives everything verbatim from the source content — same input always
 * yields byte-identical output, and nothing is invented beyond the source.
 */
export class MockSummaryProvider implements SummaryProvider {
  readonly name = "mock";

  async generateSummary(request: SummaryRequest): Promise<SummaryCardDraft> {
    validateSummaryRequest(request);
    const tonePreset = request.tonePreset ?? "teacher";
    const content = request.unit.content.trim();

    // First sentence (or first 160 chars) as the grounded summary body.
    const sentenceEnd = content.search(/[.!?。]\s|[.!?。]$/);
    const firstSentence =
      sentenceEnd >= 0 ? content.slice(0, sentenceEnd + 1) : content.slice(0, 160);
    const shortSummary = `${TONE_PREFIX[tonePreset]} ${firstSentence}`.trim();

    // Deterministic key concepts: longest unique tokens from the source text.
    const tokens = Array.from(
      new Set(
        content
          .split(/[\s,.!?:;()[\]{}"'`~]+/)
          .map((token) => token.trim())
          .filter((token) => token.length >= 2),
      ),
    );
    const keyConcepts = [...tokens]
      .sort((a, b) => b.length - a.length || a.localeCompare(b, "ko"))
      .slice(0, 3);

    const card: SummaryCardDraft = {
      shortSummary,
      keyConcepts: keyConcepts.length > 0 ? keyConcepts : [request.unit.title.trim()],
      confusionPoints: ["모의 생성 결과입니다 — 실제 모델 연결 시 혼동 포인트가 생성됩니다."],
      tonePreset,
      generation: {
        provider: this.name,
        model: "mock-deterministic-v1",
        promptVersion: MOCK_PROMPT_VERSION,
        inputSha256: sha256Hex(request.unit.content),
      },
    };
    validateSummaryCard(card);
    return card;
  }
}
