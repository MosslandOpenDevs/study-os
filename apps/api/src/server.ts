import { buildIngestionResult } from "@study-os/ingestion";
import { generateQuizDraft } from "@study-os/quiz-engine";
import { buildReviewTask } from "@study-os/scheduler";
import type { ErrorNotebookEntry, StudyUnit } from "@study-os/core";

const ingestion = buildIngestionResult({
  userId: "demo-user",
  title: "Sample Lecture",
  sourceType: "text",
  rawText: "First concept paragraph.\n\nSecond concept paragraph.",
});

const firstUnit: StudyUnit = {
  id: "study-unit-1",
  ...ingestion.units[0],
};

const quizDraft = generateQuizDraft({
  studyUnit: firstUnit,
  quizType: "short-answer",
  count: 2,
});

const notebookEntry: ErrorNotebookEntry = {
  id: "entry-1",
  userId: "demo-user",
  quizItemId: "quiz-item-1",
  attemptId: "attempt-1",
  errorType: "concept-gap",
  note: "Need to revisit the first concept.",
  nextReviewAt: undefined,
  reviewCount: 0,
};

const reviewTask = buildReviewTask(notebookEntry);

console.log("study-os api dev server");
console.log({ ingestion, quizDraft, reviewTask });
