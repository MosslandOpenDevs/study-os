import {
  QuizGenerationError,
  type QuizGenerationRequest,
  type QuizItemDraft,
  QuizValidationError,
} from "./types.js";

export const MIN_CONTENT_LENGTH = 20;
export const MAX_ITEMS = 10;
export const MIN_MCQ_CHOICES = 3;
export const MAX_MCQ_CHOICES = 5;

export function validateQuizRequest(request: QuizGenerationRequest): void {
  if (request.unit.title.trim().length === 0) {
    throw new QuizValidationError("unit.title must not be empty");
  }
  const content = request.unit.content.trim();
  if (content.length === 0) {
    throw new QuizValidationError("unit.content must not be empty");
  }
  if (content.length < MIN_CONTENT_LENGTH) {
    throw new QuizValidationError(
      `unit.content is too short to ground quiz items (${content.length} < ${MIN_CONTENT_LENGTH} chars); refusing to generate (fail-closed)`,
    );
  }
  if (!Number.isInteger(request.count) || request.count < 1 || request.count > MAX_ITEMS) {
    throw new QuizValidationError(`count must be an integer in 1..${MAX_ITEMS}`);
  }
}

/**
 * Output gate (fail-closed): if ANY item violates the contract — most
 * importantly a citation that does not resolve verbatim into the unit
 * content — the whole batch is rejected. A quiz item without verifiable
 * evidence must never be served.
 */
export function validateQuizItems(
  items: QuizItemDraft[],
  unitContent: string,
  quizType: QuizGenerationRequest["quizType"],
): void {
  if (items.length === 0) {
    throw new QuizGenerationError("generation produced no items");
  }

  for (const [index, item] of items.entries()) {
    const label = `item ${index + 1}`;

    if (item.prompt.trim().length === 0) {
      throw new QuizGenerationError(`${label}: prompt is empty`);
    }
    if (item.answer.trim().length === 0) {
      throw new QuizGenerationError(`${label}: answer is empty`);
    }
    if (!Number.isInteger(item.difficulty) || item.difficulty < 1 || item.difficulty > 5) {
      throw new QuizGenerationError(`${label}: difficulty must be an integer in 1..5`);
    }

    if (item.citations.length === 0) {
      throw new QuizGenerationError(`${label}: no citations (fail-closed — evidence is mandatory)`);
    }
    for (const citation of item.citations) {
      const resolved = unitContent.slice(citation.start, citation.end);
      if (resolved !== citation.quote || citation.quote.trim().length === 0) {
        throw new QuizGenerationError(
          `${label}: citation [${citation.start}, ${citation.end}) does not resolve to its quote (fail-closed)`,
        );
      }
    }

    if (quizType === "multiple-choice") {
      const choices = item.choices ?? [];
      if (choices.length < MIN_MCQ_CHOICES || choices.length > MAX_MCQ_CHOICES) {
        throw new QuizGenerationError(
          `${label}: multiple-choice items need ${MIN_MCQ_CHOICES}-${MAX_MCQ_CHOICES} choices`,
        );
      }
      const correct = choices.filter((choice) => choice.isCorrect);
      if (correct.length !== 1) {
        throw new QuizGenerationError(
          `${label}: exactly one choice must be correct, got ${correct.length}`,
        );
      }
      if (choices.some((choice) => choice.content.trim().length === 0)) {
        throw new QuizGenerationError(`${label}: choice contents must be non-empty`);
      }
    } else if (item.choices && item.choices.length > 0) {
      throw new QuizGenerationError(`${label}: ${quizType} items must not carry choices`);
    }

    if (quizType === "fill-in-the-blank" && !item.prompt.includes("____")) {
      throw new QuizGenerationError(
        `${label}: fill-in-the-blank prompts must contain a "____" blank marker`,
      );
    }
  }
}
