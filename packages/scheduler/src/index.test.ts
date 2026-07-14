import { describe, expect, it } from "vitest";
import {
  applyReview,
  buildDailyQueue,
  initialCardState,
  SCHEDULER_ALGORITHM,
  type SchedulerCardState,
  SchedulerValidationError,
} from "./index.js";

const NOW = new Date("2026-07-14T09:00:00.000Z");

describe("initialCardState", () => {
  it("creates a fresh card due immediately", () => {
    const state = initialCardState(NOW);
    expect(new Date(state.due).getTime()).toBeLessThanOrEqual(NOW.getTime());
    expect(state.reps).toBe(0);
    expect(state.lapses).toBe(0);
  });

  it("rejects an invalid date", () => {
    expect(() => initialCardState(new Date("nonsense"))).toThrow(SchedulerValidationError);
  });
});

describe("applyReview", () => {
  it("schedules the first review and stamps the algorithm version", () => {
    const result = applyReview(null, "good", NOW);
    expect(result.before).toBeNull();
    expect(result.after.reps).toBe(1);
    expect(result.due.getTime()).toBeGreaterThan(NOW.getTime());
    expect(result.algorithm).toBe(SCHEDULER_ALGORITHM);
    expect(SCHEDULER_ALGORITHM).toMatch(/^ts-fsrs /);
  });

  it("is deterministic: identical inputs yield identical outputs", () => {
    const a = applyReview(null, "good", NOW);
    const b = applyReview(null, "good", NOW);
    expect(a).toEqual(b);
  });

  it("grows the interval across successful reviews (no fixed 14-day cap)", () => {
    // The old stub capped at 336h forever; FSRS must keep growing.
    let state: SchedulerCardState | null = null;
    let reviewAt = NOW;
    const intervals: number[] = [];

    for (let i = 0; i < 6; i++) {
      const result = applyReview(state, "good", reviewAt);
      state = result.after;
      intervals.push(result.after.scheduledDays);
      reviewAt = result.due;
    }

    expect(intervals.at(-1) ?? 0).toBeGreaterThan(intervals[1] ?? 0);
    expect((intervals.at(-1) ?? 0) > 14).toBe(true); // exceeds the old cap
  });

  it("an 'again' rating lapses the card and shortens the interval vs 'easy'", () => {
    const first = applyReview(null, "good", NOW);
    const reviewAt = first.due;

    const again = applyReview(first.after, "again", reviewAt);
    const easy = applyReview(first.after, "easy", reviewAt);

    expect(again.after.lapses).toBeGreaterThanOrEqual(first.after.lapses);
    expect(again.due.getTime()).toBeLessThan(easy.due.getTime());
  });

  it("state survives JSON serialization round-trips", () => {
    const first = applyReview(null, "hard", NOW);
    const revived = JSON.parse(JSON.stringify(first.after)) as SchedulerCardState;
    const second = applyReview(revived, "good", first.due);
    expect(second.after.reps).toBe(2);
  });

  it("rejects invalid dates and corrupted state", () => {
    expect(() => applyReview(null, "good", new Date("nope"))).toThrow(SchedulerValidationError);
    const state = { ...initialCardState(NOW), due: "not-a-date" };
    expect(() => applyReview(state, "good", NOW)).toThrow(SchedulerValidationError);
  });
});

describe("buildDailyQueue", () => {
  function stateDueAt(iso: string): SchedulerCardState {
    return { ...initialCardState(new Date("2026-07-01T00:00:00.000Z")), due: iso };
  }

  it("includes only items due at or before now, ordered by priority", () => {
    const queue = buildDailyQueue(
      [
        {
          errorEpisodeId: "future",
          state: stateDueAt("2026-07-15T00:00:00.000Z"),
          recurrenceCount: 5,
        },
        {
          errorEpisodeId: "overdue-long",
          state: stateDueAt("2026-07-10T09:00:00.000Z"),
          recurrenceCount: 0,
        },
        {
          errorEpisodeId: "recurring",
          state: stateDueAt("2026-07-14T08:00:00.000Z"),
          recurrenceCount: 1,
          confirmedCause: "concept-gap",
        },
      ],
      NOW,
    );

    // A single recurrence outranks ~4 days of overdue time.
    expect(queue.map((i) => i.errorEpisodeId)).toEqual(["recurring", "overdue-long"]);
    expect(queue[0]?.confirmedCause).toBe("concept-gap");
    expect(queue[1]?.overdueMinutes).toBe(4 * 24 * 60);
  });

  it("breaks priority ties deterministically by episode id", () => {
    const state = stateDueAt("2026-07-14T08:00:00.000Z");
    const queue = buildDailyQueue(
      [
        { errorEpisodeId: "b", state, recurrenceCount: 0 },
        { errorEpisodeId: "a", state, recurrenceCount: 0 },
      ],
      NOW,
    );
    expect(queue.map((i) => i.errorEpisodeId)).toEqual(["a", "b"]);
  });

  it("rejects negative or non-integer recurrence counts", () => {
    const state = stateDueAt("2026-07-14T08:00:00.000Z");
    for (const recurrenceCount of [-1, 1.5, Number.NaN]) {
      expect(() => buildDailyQueue([{ errorEpisodeId: "x", state, recurrenceCount }], NOW)).toThrow(
        SchedulerValidationError,
      );
    }
  });

  it("rejects invalid due dates and an invalid now", () => {
    const state = stateDueAt("garbage");
    expect(() =>
      buildDailyQueue([{ errorEpisodeId: "x", state, recurrenceCount: 0 }], NOW),
    ).toThrow(SchedulerValidationError);
    expect(() => buildDailyQueue([], new Date("nope"))).toThrow(SchedulerValidationError);
  });
});
