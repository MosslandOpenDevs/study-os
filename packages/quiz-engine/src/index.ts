export {
  ANTHROPIC_QUIZ_PROMPT_VERSION,
  AnthropicQuizProvider,
  type AnthropicQuizProviderOptions,
  DEFAULT_QUIZ_MODEL,
} from "./anthropic.js";
export { resolveQuotesToCitations } from "./citations.js";
export {
  type GradableItem,
  type GradingResult,
  gradeShortAnswer,
  normalizeAnswer,
} from "./grading.js";
export { MOCK_QUIZ_PROMPT_VERSION, MockQuizProvider } from "./mock.js";
export * from "./types.js";
export {
  MAX_ITEMS,
  MAX_MCQ_CHOICES,
  MIN_CONTENT_LENGTH,
  MIN_MCQ_CHOICES,
  validateQuizItems,
  validateQuizRequest,
} from "./validate.js";

import { AnthropicQuizProvider } from "./anthropic.js";
import { MockQuizProvider } from "./mock.js";
import type { QuizProvider } from "./types.js";

/**
 * Anthropic-backed provider when ANTHROPIC_API_KEY is set, otherwise the
 * deterministic offline mock — dev/CI never require a key or network.
 */
export function createDefaultQuizProvider(): QuizProvider {
  if (process.env.ANTHROPIC_API_KEY) {
    return new AnthropicQuizProvider();
  }
  return new MockQuizProvider();
}
