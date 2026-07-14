/**
 * FSRS adapter (issue #5). Everything ts-fsrs lives behind this module —
 * callers only see serializable state snapshots and plain ratings, so the
 * algorithm can be upgraded (or recomputed from raw ReviewEvents) without
 * touching any caller.
 */
import {
  type Card,
  type CardInput,
  createEmptyCard,
  FSRSVersion,
  fsrs,
  type Grade,
  Rating,
} from "ts-fsrs";

export type SchedulerRating = "again" | "hard" | "good" | "easy";

/** Algorithm identifier persisted on every ReviewEvent for recomputability. */
export const SCHEDULER_ALGORITHM = `ts-fsrs ${FSRSVersion}`;

export class SchedulerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchedulerValidationError";
  }
}

/**
 * Opaque, JSON-serializable FSRS card state (ISO-8601 dates). Stored verbatim
 * in ReviewEvent.schedulerStateBefore/After — never interpreted retroactively.
 */
export interface SchedulerCardState {
  due: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview?: string;
}

const RATING_MAP: Record<SchedulerRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

// Default parameters; fuzz is off by default, so scheduling is deterministic.
const engine = fsrs();

function assertValidDate(value: Date, label: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new SchedulerValidationError(`${label} is not a valid date`);
  }
}

function parseIsoDate(value: string, label: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new SchedulerValidationError(`${label} is not a valid ISO date: ${value}`);
  }
  return parsed;
}

function fromCard(card: Card): SchedulerCardState {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review?.toISOString(),
  };
}

function toCardInput(state: SchedulerCardState): CardInput {
  return {
    due: parseIsoDate(state.due, "state.due"),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.elapsedDays,
    scheduled_days: state.scheduledDays,
    learning_steps: state.learningSteps,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state,
    last_review: state.lastReview ? parseIsoDate(state.lastReview, "state.lastReview") : undefined,
  };
}

/** Fresh card state for an episode that has never been reviewed (due now). */
export function initialCardState(now: Date): SchedulerCardState {
  assertValidDate(now, "now");
  return fromCard(createEmptyCard(now));
}

export interface ReviewApplication {
  /** State before this review (null for the first review). */
  before: SchedulerCardState | null;
  /** State after this review — persist as schedulerStateAfter. */
  after: SchedulerCardState;
  /** Next due date derived from `after`. */
  due: Date;
  /** Algorithm identifier — persist on the ReviewEvent. */
  algorithm: string;
}

/**
 * Applies one review to a card state. Pure and deterministic: identical
 * (state, rating, now) always produces identical output.
 */
export function applyReview(
  state: SchedulerCardState | null | undefined,
  rating: SchedulerRating,
  now: Date,
): ReviewApplication {
  assertValidDate(now, "now");
  const grade = RATING_MAP[rating];
  if (grade === undefined) {
    throw new SchedulerValidationError(`unknown rating: ${String(rating)}`);
  }

  const card = state ? toCardInput(state) : createEmptyCard(now);
  const { card: next } = engine.next(card, now, grade);

  return {
    before: state ?? null,
    after: fromCard(next),
    due: next.due,
    algorithm: SCHEDULER_ALGORITHM,
  };
}
