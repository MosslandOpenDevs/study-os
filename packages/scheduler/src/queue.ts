import { type SchedulerCardState, SchedulerValidationError } from "./adapter.js";

/** One schedulable episode, as loaded from the database. */
export interface ReviewQueueInput {
  errorEpisodeId: string;
  state: SchedulerCardState;
  /** Learner-confirmed cause, if any (informational, returned on the item). */
  confirmedCause?: string | null;
  /**
   * How often this error has recurred — the count of FAILED transfer
   * attempts. Recurring errors are exactly what the product exists to fix,
   * so they dominate queue priority.
   */
  recurrenceCount: number;
}

export interface ReviewQueueItem {
  errorEpisodeId: string;
  due: Date;
  overdueMinutes: number;
  recurrenceCount: number;
  confirmedCause?: string | null;
  /** recurrenceCount * 10_000 + overdueMinutes — see buildDailyQueue. */
  priority: number;
}

/**
 * Builds the daily review queue: episodes whose card is due at or before
 * `now`, prioritized deterministically.
 *
 * Priority = recurrenceCount * 10_000 + overdueMinutes:
 * - a recurring error (failed transfer attempt) outranks ~7 days of overdue
 *   time per recurrence, so weak spots surface first;
 * - among equals, the longest-overdue item wins;
 * - remaining ties break on errorEpisodeId for a stable order.
 */
export function buildDailyQueue(inputs: ReviewQueueInput[], now: Date): ReviewQueueItem[] {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new SchedulerValidationError("now is not a valid date");
  }

  const items: ReviewQueueItem[] = [];
  for (const input of inputs) {
    if (!Number.isInteger(input.recurrenceCount) || input.recurrenceCount < 0) {
      throw new SchedulerValidationError(
        `recurrenceCount must be a non-negative integer, got ${input.recurrenceCount} (episode ${input.errorEpisodeId})`,
      );
    }
    const due = new Date(input.state.due);
    if (Number.isNaN(due.getTime())) {
      throw new SchedulerValidationError(
        `state.due is not a valid ISO date (episode ${input.errorEpisodeId})`,
      );
    }
    if (due.getTime() > now.getTime()) {
      continue; // Not due yet.
    }
    const overdueMinutes = Math.floor((now.getTime() - due.getTime()) / 60_000);
    items.push({
      errorEpisodeId: input.errorEpisodeId,
      due,
      overdueMinutes,
      recurrenceCount: input.recurrenceCount,
      confirmedCause: input.confirmedCause,
      priority: input.recurrenceCount * 10_000 + overdueMinutes,
    });
  }

  return items.sort(
    (a, b) => b.priority - a.priority || a.errorEpisodeId.localeCompare(b.errorEpisodeId),
  );
}
