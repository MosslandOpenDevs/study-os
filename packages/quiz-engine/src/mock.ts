import { resolveQuotesToCitations } from "./citations.js";
import { sha256Hex } from "./hash.js";
import type {
  QuizChoiceDraft,
  QuizDraftResult,
  QuizGenerationRequest,
  QuizItemDraft,
  QuizProvider,
} from "./types.js";
import { validateQuizItems, validateQuizRequest } from "./validate.js";

export const MOCK_QUIZ_PROMPT_VERSION = "ko-quiz-mock-v1";

const CHOICE_LABELS = ["가", "나", "다", "라", "마"];

function splitSentences(content: string): string[] {
  return content
    .split(/(?<=[.!?。])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 5);
}

function keyToken(sentence: string): string {
  const tokens = sentence
    .split(/[\s,.!?:;()[\]{}"'`~]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
  return [...tokens].sort((a, b) => b.length - a.length || a.localeCompare(b, "ko"))[0] ?? sentence;
}

/**
 * Deterministic, offline QuizProvider. Every item is derived verbatim from
 * one source sentence, so citations always resolve by construction — the
 * same fail-closed validation gate as the model-backed provider still runs.
 */
export class MockQuizProvider implements QuizProvider {
  readonly name = "mock";

  async generateQuiz(request: QuizGenerationRequest): Promise<QuizDraftResult> {
    validateQuizRequest(request);
    const content = request.unit.content;
    const sentences = splitSentences(content);
    if (sentences.length === 0) {
      throw new Error("unreachable: validated content produced no sentences");
    }

    const allTokens = Array.from(new Set(sentences.map(keyToken)));
    const items: QuizItemDraft[] = [];

    for (let i = 0; i < request.count; i++) {
      const sentence = sentences[i % sentences.length] as string;
      const token = keyToken(sentence);
      const blanked = sentence.replace(token, "____");
      const citations = resolveQuotesToCitations([sentence], content);
      const difficulty = 1 + (i % 3);

      const base = {
        answer: token,
        acceptedAnswers: [token],
        explanation: `자료 원문 근거: "${sentence}"`,
        difficulty,
        citations,
      };

      if (request.quizType === "multiple-choice") {
        const distractors = allTokens.filter((candidate) => candidate !== token).slice(0, 3);
        while (distractors.length < 2) {
          distractors.push(`오답 보기 ${distractors.length + 1}`);
        }
        const choices: QuizChoiceDraft[] = [token, ...distractors].map((choice, index) => ({
          label: CHOICE_LABELS[index] ?? String(index + 1),
          content: choice,
          isCorrect: choice === token,
        }));
        items.push({
          ...base,
          prompt: `『${request.unit.title}』 자료에서, 다음 빈칸에 들어갈 말로 알맞은 것은? "${blanked}"`,
          choices,
        });
      } else if (request.quizType === "fill-in-the-blank") {
        items.push({
          ...base,
          prompt: `빈칸을 채우시오: "${blanked}"`,
        });
      } else {
        items.push({
          ...base,
          prompt: `『${request.unit.title}』 자료 기준으로, 다음 문장의 빈칸에 들어갈 용어를 쓰시오: "${blanked}"`,
        });
      }
    }

    validateQuizItems(items, content, request.quizType);

    return {
      items,
      generation: {
        provider: this.name,
        model: "mock-deterministic-v1",
        promptVersion: MOCK_QUIZ_PROMPT_VERSION,
        inputSha256: sha256Hex(content),
      },
    };
  }
}
