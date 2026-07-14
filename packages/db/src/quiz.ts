import type { QuizDraftResult, QuizItemType } from "@study-os/quiz-engine";
import type { PrismaClient } from "./generated/prisma/client.js";

const QUIZ_TYPE_MAP = {
  "multiple-choice": "multiple_choice",
  "short-answer": "short_answer",
  "fill-in-the-blank": "fill_in_the_blank",
} as const;

export interface PersistQuizInput {
  studyUnit: {
    id: string;
    sourceRevisionId: string;
    /**
     * Offset of the unit's content within its revision's rawText. Citation
     * offsets are unit-relative; adding this maps them onto the revision so
     * every QuizItemCitation resolves against the immutable source snapshot.
     */
    citationStart: number;
  };
  quizType: QuizItemType;
  title: string;
  result: QuizDraftResult;
}

export interface PersistedQuiz {
  quizSetId: string;
  generationRunId: string;
  quizItemIds: string[];
}

/**
 * Persists a generated quiz atomically: GenerationRun provenance, the
 * QuizSet, and per item its choices, SourceSpans (revision-mapped), and
 * citation links — one transaction, real foreign keys throughout.
 */
export async function persistQuizDraft(
  prisma: PrismaClient,
  input: PersistQuizInput,
): Promise<PersistedQuiz> {
  const { result } = input;

  return prisma.$transaction(async (tx) => {
    const run = await tx.generationRun.create({
      data: {
        kind: "quiz",
        provider: result.generation.provider,
        model: result.generation.model,
        promptVersion: result.generation.promptVersion,
        inputSha256: result.generation.inputSha256,
        inputTokens: result.generation.inputTokens,
        outputTokens: result.generation.outputTokens,
      },
    });

    const quizSet = await tx.quizSet.create({
      data: {
        studyUnitId: input.studyUnit.id,
        title: input.title,
        quizType: QUIZ_TYPE_MAP[input.quizType],
      },
    });

    const quizItemIds: string[] = [];
    for (const item of result.items) {
      const created = await tx.quizItem.create({
        data: {
          quizSetId: quizSet.id,
          prompt: item.prompt,
          answer: item.answer,
          acceptedAnswers: item.acceptedAnswers,
          explanation: item.explanation,
          difficulty: item.difficulty,
          generationRunId: run.id,
          choices: item.choices
            ? {
                create: item.choices.map((choice, orderIndex) => ({
                  label: choice.label,
                  content: choice.content,
                  isCorrect: choice.isCorrect,
                  orderIndex,
                })),
              }
            : undefined,
        },
      });

      // Unit-relative citation offsets → revision offsets.
      for (const [orderIndex, citation] of item.citations.entries()) {
        const span = await tx.sourceSpan.create({
          data: {
            sourceRevisionId: input.studyUnit.sourceRevisionId,
            start: input.studyUnit.citationStart + citation.start,
            end: input.studyUnit.citationStart + citation.end,
          },
        });
        await tx.quizItemCitation.create({
          data: { quizItemId: created.id, sourceSpanId: span.id, orderIndex },
        });
      }

      quizItemIds.push(created.id);
    }

    return { quizSetId: quizSet.id, generationRunId: run.id, quizItemIds };
  });
}
