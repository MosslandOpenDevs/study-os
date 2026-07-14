import type { ErrorNotebookEntry, ReviewStatus, ReviewTask } from "@study-os/core";

export interface ReviewScheduleRule {
  reviewCount: number;
  delayHours: number;
}

export const defaultReviewSchedule: ReviewScheduleRule[] = [
  { reviewCount: 0, delayHours: 24 },
  { reviewCount: 1, delayHours: 72 },
  { reviewCount: 2, delayHours: 168 },
  { reviewCount: 3, delayHours: 336 },
];

export function getNextReviewDate(entry: ErrorNotebookEntry, now = new Date()): Date {
  const rule =
    defaultReviewSchedule.find((candidate) => candidate.reviewCount === entry.reviewCount) ??
    defaultReviewSchedule[defaultReviewSchedule.length - 1];

  return new Date(now.getTime() + rule.delayHours * 60 * 60 * 1000);
}

export function buildReviewTask(
  entry: ErrorNotebookEntry,
  now = new Date(),
): Omit<ReviewTask, "id"> {
  return {
    userId: entry.userId,
    notebookEntryId: entry.id,
    scheduledAt: getNextReviewDate(entry, now).toISOString(),
    status: "pending" satisfies ReviewStatus,
  };
}

export function getDueReviewTasks(tasks: ReviewTask[], now = new Date()): ReviewTask[] {
  return tasks.filter((task) => task.status === "pending" && new Date(task.scheduledAt) <= now);
}
