import {
  type SummaryCardDraft,
  SummaryGenerationError,
  type SummaryRequest,
  SummaryValidationError,
} from "./types.js";

/** Below this many characters the content cannot meaningfully ground a summary. */
export const MIN_CONTENT_LENGTH = 20;
export const MAX_KEY_CONCEPTS = 10;
export const MAX_CONFUSION_POINTS = 10;
export const MAX_SHORT_SUMMARY_LENGTH = 2000;

export function validateSummaryRequest(request: SummaryRequest): void {
  if (request.unit.title.trim().length === 0) {
    throw new SummaryValidationError("unit.title must not be empty");
  }
  const content = request.unit.content.trim();
  if (content.length === 0) {
    throw new SummaryValidationError("unit.content must not be empty");
  }
  if (content.length < MIN_CONTENT_LENGTH) {
    throw new SummaryValidationError(
      `unit.content is too short to ground a summary (${content.length} < ${MIN_CONTENT_LENGTH} chars); refusing to generate (fail-closed)`,
    );
  }
}

/**
 * Output-side gate: a generated card that violates these bounds is discarded
 * entirely (fail-closed) rather than partially accepted.
 */
export function validateSummaryCard(
  card: Pick<SummaryCardDraft, "shortSummary" | "keyConcepts" | "confusionPoints">,
): void {
  if (card.shortSummary.trim().length === 0) {
    throw new SummaryGenerationError("generated shortSummary is empty");
  }
  if (card.shortSummary.length > MAX_SHORT_SUMMARY_LENGTH) {
    throw new SummaryGenerationError(
      `generated shortSummary exceeds ${MAX_SHORT_SUMMARY_LENGTH} chars`,
    );
  }
  if (card.keyConcepts.length === 0 || card.keyConcepts.length > MAX_KEY_CONCEPTS) {
    throw new SummaryGenerationError(
      `generated keyConcepts must contain 1-${MAX_KEY_CONCEPTS} items, got ${card.keyConcepts.length}`,
    );
  }
  if (card.confusionPoints.length > MAX_CONFUSION_POINTS) {
    throw new SummaryGenerationError(
      `generated confusionPoints must contain at most ${MAX_CONFUSION_POINTS} items`,
    );
  }
  for (const value of [...card.keyConcepts, ...card.confusionPoints]) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new SummaryGenerationError("generated list items must be non-empty strings");
    }
  }
}
