import { type QuizCitation, QuizGenerationError } from "./types.js";

/**
 * Resolves model-produced evidence QUOTES into verified [start, end) offsets.
 *
 * Models are unreliable at emitting character offsets, so providers ask for
 * verbatim quotes instead and this function anchors them deterministically:
 * a quote that does not occur verbatim in the unit content fails the whole
 * generation (fail-closed) — this is what makes "citations resolve 100%"
 * an invariant rather than an aspiration.
 */
export function resolveQuotesToCitations(quotes: string[], unitContent: string): QuizCitation[] {
  if (quotes.length === 0) {
    throw new QuizGenerationError("no evidence quotes provided (fail-closed)");
  }
  return quotes.map((quote) => {
    const trimmed = quote.trim();
    if (trimmed.length === 0) {
      throw new QuizGenerationError("empty evidence quote (fail-closed)");
    }
    const start = unitContent.indexOf(trimmed);
    if (start === -1) {
      throw new QuizGenerationError(
        `evidence quote not found verbatim in the source content (fail-closed): "${trimmed.slice(0, 60)}"`,
      );
    }
    return { start, end: start + trimmed.length, quote: trimmed };
  });
}
