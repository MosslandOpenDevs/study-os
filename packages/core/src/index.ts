export const productVision =
  "Korean-first study tooling, being narrowed toward a source-grounded error-remediation engine for a single exam track. Experimental pre-alpha scaffold — not a released product.";

export type StudyMaterialType = "pdf" | "markdown" | "text";
export type GoalType = "exam" | "course" | "custom";
export type GoalStatus = "active" | "completed" | "paused";
export type QuizType = "multiple-choice" | "short-answer" | "fill-in-the-blank";
export type ErrorType = "concept-gap" | "careless-mistake" | "misread-question" | "time-pressure";
export type ReviewStatus = "pending" | "done" | "skipped";

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

export interface ReviewTask {
  id: string;
  userId: string;
  notebookEntryId: string;
  scheduledAt: string;
  status: ReviewStatus;
}
