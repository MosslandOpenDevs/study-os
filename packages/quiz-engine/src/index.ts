import type { QuizItem, QuizType, StudyUnit } from "@study-os/core";

export interface QuizGenerationRequest {
  studyUnit: StudyUnit;
  quizType: QuizType;
  count: number;
}

export interface QuizDraft extends Omit<QuizItem, "id" | "quizSetId"> {}

export function generateQuizDraft(request: QuizGenerationRequest): QuizDraft[] {
  const basePrompt = request.studyUnit.content.slice(0, 180).trim();

  return Array.from({ length: request.count }, (_, index) => ({
    prompt: `Question ${index + 1}: Explain the key point of \"${request.studyUnit.title}\" based on: ${basePrompt}`,
    answer: `Model answer for ${request.studyUnit.title} (${request.quizType})`,
    explanation: "This is a placeholder explanation to be replaced by model-backed generation.",
    difficulty: 1,
    createdAt: new Date().toISOString(),
  }));
}

export function gradeAnswer(expectedAnswer: string, submittedAnswer: string): boolean {
  const normalizedExpected = expectedAnswer.trim().toLowerCase();
  const normalizedSubmitted = submittedAnswer.trim().toLowerCase();

  return normalizedExpected.length > 0 && normalizedExpected === normalizedSubmitted;
}
