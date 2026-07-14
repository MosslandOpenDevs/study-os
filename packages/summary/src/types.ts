/**
 * Summary generation contract (issue #10).
 *
 * A SummaryProvider turns one study unit into a Korean-first summary card.
 * Implementations must be fail-closed: if the source content is missing or
 * insufficient as evidence, they throw instead of inventing a summary.
 */

export type TonePreset = "teacher" | "tutor" | "concise-exam";

export interface SummaryUnitInput {
  /** Study unit title (shown to the model as context, not as evidence). */
  title: string;
  /** The ONLY evidence the summary may be grounded in. */
  content: string;
}

export interface SummaryRequest {
  unit: SummaryUnitInput;
  /** Defaults to "teacher". */
  tonePreset?: TonePreset;
}

/**
 * Provenance metadata for one generation run. Persisted alongside the card so
 * results remain attributable and reproducible (model, prompt version, input
 * hash, token usage).
 */
export interface GenerationRunInfo {
  provider: string;
  model: string;
  promptVersion: string;
  /** SHA-256 (hex) of the exact unit content the card was grounded in. */
  inputSha256: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface SummaryCardDraft {
  shortSummary: string;
  keyConcepts: string[];
  confusionPoints: string[];
  tonePreset: TonePreset;
  generation: GenerationRunInfo;
}

export interface SummaryProvider {
  readonly name: string;
  generateSummary(request: SummaryRequest): Promise<SummaryCardDraft>;
}

/** Invalid input (empty title/content, content too short to ground a summary). */
export class SummaryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SummaryValidationError";
  }
}

/** Generation failed or was refused; no partial output is ever returned. */
export class SummaryGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SummaryGenerationError";
  }
}
