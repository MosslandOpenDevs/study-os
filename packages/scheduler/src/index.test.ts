import type { ErrorNotebookEntry, ReviewTask } from "@study-os/core";
import { describe, expect, it } from "vitest";
import { buildReviewTask, getDueReviewTasks, getNextReviewDate } from "./index.js";

const HOUR_MS = 60 * 60 * 1000;

function entryWithReviewCount(reviewCount: number): ErrorNotebookEntry {
  return {
    id: "entry-1",
    userId: "u1",
    quizItemId: "q1",
    attemptId: "a1",
    errorType: "concept-gap",
    reviewCount,
  };
}

describe("getNextReviewDate", () => {
  const now = new Date("2026-07-14T00:00:00.000Z");

  it.each([
    [0, 24],
    [1, 72],
    [2, 168],
    [3, 336],
  ])("review count %i schedules %ih later", (reviewCount, hours) => {
    const next = getNextReviewDate(entryWithReviewCount(reviewCount), now);
    expect(next.getTime() - now.getTime()).toBe(hours * HOUR_MS);
  });

  // Known stub limitation, tracked by issue #5: the interval is capped at 336h
  // (14 days) forever after the 4th review — there is no FSRS. Pinned
  // deliberately so the #5 rework must update this test.
  it("caps at 336h for every later review (issue #5)", () => {
    for (const reviewCount of [4, 5, 10, 100]) {
      const next = getNextReviewDate(entryWithReviewCount(reviewCount), now);
      expect(next.getTime() - now.getTime()).toBe(336 * HOUR_MS);
    }
  });
});

describe("buildReviewTask", () => {
  it("builds a pending task for the entry owner", () => {
    const now = new Date("2026-07-14T00:00:00.000Z");
    const task = buildReviewTask(entryWithReviewCount(0), now);

    expect(task).toEqual({
      userId: "u1",
      notebookEntryId: "entry-1",
      scheduledAt: new Date(now.getTime() + 24 * HOUR_MS).toISOString(),
      status: "pending",
    });
  });
});

describe("getDueReviewTasks", () => {
  const now = new Date("2026-07-14T12:00:00.000Z");

  function task(overrides: Partial<ReviewTask>): ReviewTask {
    return {
      id: "t1",
      userId: "u1",
      notebookEntryId: "e1",
      scheduledAt: now.toISOString(),
      status: "pending",
      ...overrides,
    };
  }

  it("returns pending tasks scheduled at or before now", () => {
    const due = task({ id: "due", scheduledAt: new Date(now.getTime() - 1000).toISOString() });
    const exact = task({ id: "exact", scheduledAt: now.toISOString() });
    const future = task({
      id: "future",
      scheduledAt: new Date(now.getTime() + 1000).toISOString(),
    });
    const done = task({ id: "done", status: "done" });

    const result = getDueReviewTasks([due, exact, future, done], now);
    expect(result.map((t) => t.id)).toEqual(["due", "exact"]);
  });
});
