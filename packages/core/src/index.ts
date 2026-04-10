export const productVision =
  "A Korean-first AI study operating system for notes, quizzes, review, and exam planning.";

export type StudyMaterialType = "pdf" | "markdown" | "text";

export interface StudyGoal {
  id: string;
  title: string;
  examDate?: string;
}
