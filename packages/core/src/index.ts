export const productVision =
  "Korean-first study tooling, being narrowed toward a source-grounded error-remediation engine for a single exam track. Experimental pre-alpha scaffold — not a released product.";

export type StudyMaterialType = "pdf" | "markdown" | "text";
export type GoalType = "exam" | "course" | "custom";
export type GoalStatus = "active" | "completed" | "paused";
export type QuizType = "multiple-choice" | "short-answer" | "fill-in-the-blank";

/** @deprecated Replaced by ErrorCause in the ErrorEpisode remediation model (issue #2). */
export type ErrorType = "concept-gap" | "careless-mistake" | "misread-question" | "time-pressure";
/** @deprecated Replaced by the raw ReviewEvent log (issue #2); removal tracked by issue #5. */
export type ReviewStatus = "pending" | "done" | "skipped";

// ---------------------------------------------------------------------------
// Remediation loop domain (issue #2): ErrorEpisode replaces the old
// error-notebook. The model proposes a cause; only the learner confirms it.
// ---------------------------------------------------------------------------

export type ErrorCause =
  | "concept-gap"
  | "condition-misread"
  | "procedure-slip"
  | "time-pressure"
  | "faulty-item";

export type ErrorEpisodeStatus =
  | "open"
  | "cause-confirmed"
  | "intervened"
  | "resolved"
  | "item-faulty";

export type InterventionKind =
  | "reexplanation"
  | "prerequisite-check"
  | "condition-drill"
  | "checklist"
  | "discrimination-set"
  | "timed-set"
  | "item-regenerated";

export type TransferResult = "pending" | "passed" | "failed";
export type ReviewRating = "again" | "hard" | "good" | "easy";
export type GradingMethod = "exact-match" | "normalized-match" | "model-graded" | "manual";

/** Half-open [start, end) offset range into a SourceRevision's rawText. */
export interface SourceSpan {
  id: string;
  sourceRevisionId: string;
  start: number;
  end: number;
}

export interface ErrorEpisode {
  id: string;
  userId: string;
  quizItemId: string;
  attemptId: string;
  status: ErrorEpisodeStatus;
  /** Model-proposed hypothesis — never authoritative on its own. */
  suggestedCause?: ErrorCause;
  /** Learner-confirmed cause — the only basis for interventions. */
  confirmedCause?: ErrorCause;
  confirmedAt?: string;
  note?: string;
}

export interface Intervention {
  id: string;
  errorEpisodeId: string;
  kind: InterventionKind;
  content?: string;
}

export interface TransferAttempt {
  id: string;
  errorEpisodeId: string;
  quizItemId: string;
  attemptId?: string;
  result: TransferResult;
}

/**
 * Raw, append-only review log entry. Scheduler state snapshots are opaque so
 * schedules can be recomputed when the algorithm changes.
 */
export interface ReviewEvent {
  id: string;
  userId: string;
  errorEpisodeId?: string;
  rating: ReviewRating;
  latencyMs?: number;
  algorithm: string;
  schedulerStateBefore?: unknown;
  schedulerStateAfter?: unknown;
  scheduledAt?: string;
  reviewedAt: string;
}

export interface User {
  id: string;
  displayName: string;
  locale: string;
  timezone: string;
  createdAt: string;
}

export interface StudyGoal {
  id: string;
  userId: string;
  title: string;
  targetDate?: string;
  goalType: GoalType;
  status: GoalStatus;
}

export interface StudySource {
  id: string;
  userId: string;
  title: string;
  sourceType: StudyMaterialType;
  originalFilename?: string;
  storageUrl?: string;
  createdAt: string;
}

export interface StudyUnit {
  id: string;
  sourceId: string;
  title: string;
  content: string;
  orderIndex: number;
  citationStart?: number;
  citationEnd?: number;
}

export interface SummaryCard {
  id: string;
  studyUnitId: string;
  shortSummary: string;
  keyConcepts: string[];
  confusionPoints: string[];
  tonePreset: string;
}

export interface QuizSet {
  id: string;
  studyUnitId: string;
  title: string;
  quizType: QuizType;
  createdAt: string;
}

export interface QuizItem {
  id: string;
  quizSetId: string;
  prompt: string;
  answer: string;
  explanation?: string;
  difficulty?: number;
}

export interface Attempt {
  id: string;
  userId: string;
  quizItemId: string;
  submittedAnswer: string;
  isCorrect: boolean;
  createdAt: string;
}

/**
 * @deprecated Replaced by ErrorEpisode (issue #2). The database table is
 * gone; this type survives only for the scheduler stub until issue #5 lands.
 */
export interface ErrorNotebookEntry {
  id: string;
  userId: string;
  quizItemId: string;
  attemptId: string;
  errorType: ErrorType;
  note?: string;
  nextReviewAt?: string;
  reviewCount: number;
}

/**
 * @deprecated Replaced by the raw ReviewEvent log (issue #2). The database
 * table is gone; this type survives only for the scheduler stub until issue
 * #5 lands.
 */
export interface ReviewTask {
  id: string;
  userId: string;
  notebookEntryId: string;
  scheduledAt: string;
  status: ReviewStatus;
}
