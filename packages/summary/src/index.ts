export {
  ANTHROPIC_PROMPT_VERSION,
  AnthropicSummaryProvider,
  type AnthropicSummaryProviderOptions,
  DEFAULT_SUMMARY_MODEL,
} from "./anthropic.js";
export { MOCK_PROMPT_VERSION, MockSummaryProvider } from "./mock.js";
export * from "./types.js";
export {
  MAX_CONFUSION_POINTS,
  MAX_KEY_CONCEPTS,
  MAX_SHORT_SUMMARY_LENGTH,
  MIN_CONTENT_LENGTH,
  validateSummaryCard,
  validateSummaryRequest,
} from "./validate.js";

import { AnthropicSummaryProvider } from "./anthropic.js";
import { MockSummaryProvider } from "./mock.js";
import type { SummaryProvider } from "./types.js";

/**
 * Anthropic-backed provider when ANTHROPIC_API_KEY is set, otherwise the
 * deterministic offline mock — so dev/CI never require a key and never make
 * network calls unless explicitly configured.
 */
export function createDefaultSummaryProvider(): SummaryProvider {
  if (process.env.ANTHROPIC_API_KEY) {
    return new AnthropicSummaryProvider();
  }
  return new MockSummaryProvider();
}
