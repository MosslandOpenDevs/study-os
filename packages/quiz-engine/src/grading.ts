/**
 * Short-answer grading with Korean-aware normalization. Replaces the old
 * exact lowercased string match, which rejected semantically identical
 * Korean answers over whitespace or Unicode-composition differences.
 */

export interface GradableItem {
  answer: string;
  acceptedAnswers?: string[];
}

export interface GradingResult {
  isCorrect: boolean;
  /** Mirrors the Prisma GradingMethod enum value used for this decision. */
  gradingMethod: "normalized_match";
}

/**
 * NFC-normalizes (한글 조합형/완성형 differences), trims, collapses internal
 * whitespace, case-folds latin, and strips trailing sentence punctuation.
 */
export function normalizeAnswer(value: string): string {
  return value
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.。!?]+$/u, "")
    .toLowerCase();
}

export function gradeShortAnswer(item: GradableItem, submitted: string): GradingResult {
  const normalizedSubmitted = normalizeAnswer(submitted);
  if (normalizedSubmitted.length === 0) {
    return { isCorrect: false, gradingMethod: "normalized_match" };
  }

  const candidates = [item.answer, ...(item.acceptedAnswers ?? [])]
    .map(normalizeAnswer)
    .filter((candidate) => candidate.length > 0);

  return {
    isCorrect: candidates.includes(normalizedSubmitted),
    gradingMethod: "normalized_match",
  };
}
