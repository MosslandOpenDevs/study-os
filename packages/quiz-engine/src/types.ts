/**
 * Quiz generation contract. Every generated item MUST carry citations that
 * resolve verbatim into the source unit's content — items without resolvable
 * evidence are never returned (fail-closed).
 */

export type QuizItemType = "multiple-choice" | "short-answer" | "fill-in-the-blank";

export interface QuizUnitInput {
  /** Study unit title (context only, not evidence). */
  title: string;
  /** The ONLY evidence questions may be grounded in. */
  content: string;
}

export interface QuizGenerationRequest {
  unit: QuizUnitInput;
  quizType: QuizItemType;
  /** 1..10 items. */
  count: number;
}

/** Half-open [start, end) offsets into the unit's content. */
export interface QuizCitation {
  start: number;
  end: number;
  /** The exact substring: unit.content.slice(start, end). */
  quote: string;
}

export interface QuizChoiceDraft {
  label: string;
  content: string;
  isCorrect: boolean;
}

export interface QuizItemDraft {
  prompt: string;
  answer: string;
  /** Additional accepted answers for normalized short-answer grading. */
  acceptedAnswers: string[];
  explanation: string;
  /** 1 (easy) .. 5 (hard). */
  difficulty: number;
  /** Non-empty; every entry resolves verbatim into the unit content. */
  citations: QuizCitation[];
  /** Present only for multiple-choice items (3-5 choices, exactly 1 correct). */
  choices?: QuizChoiceDraft[];
}

/** Provenance for the generation run (mirrors the GenerationRun table). */
export interface QuizGenerationInfo {
  provider: string;
  model: string;
  promptVersion: string;
  inputSha256: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface QuizDraftResult {
  items: QuizItemDraft[];
  generation: QuizGenerationInfo;
}

export interface QuizProvider {
  readonly name: string;
  generateQuiz(request: QuizGenerationRequest): Promise<QuizDraftResult>;
}

/** Invalid input (bad count, empty/too-short content). */
export class QuizValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuizValidationError";
  }
}

/** Generation failed, was refused, or produced unverifiable output. */
export class QuizGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuizGenerationError";
  }
}
