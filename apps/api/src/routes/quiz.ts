import type { PrismaClient } from "@study-os/db";
import { persistQuizDraft } from "@study-os/db";
import {
  gradeShortAnswer,
  QuizGenerationError,
  type QuizProvider,
  QuizValidationError,
} from "@study-os/quiz-engine";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

/**
 * Quiz generation and attempt endpoints — the application wiring that closes
 * the remediation loop: generate evidence-cited items from a persisted unit,
 * grade attempts with Korean-aware normalization, and open an ErrorEpisode
 * automatically on every wrong answer.
 */

const generateQuizSchema = z.object({
  quizType: z.enum(["multiple-choice", "short-answer", "fill-in-the-blank"]),
  count: z.number().int().min(1).max(10),
});

const attemptSchema = z.object({
  userId: z.string().min(1),
  answer: z.string(),
  latencyMs: z.number().int().nonnegative().optional(),
  confidence: z.number().int().min(0).max(100).optional(),
});

function databaseUnavailable(reply: FastifyReply) {
  return reply.status(503).send({
    error: "database is not configured (set DATABASE_URL and start Postgres)",
  });
}

export function registerQuizRoutes(
  app: FastifyInstance,
  prisma: PrismaClient | undefined,
  quizProvider: QuizProvider,
) {
  // Generate + persist an evidence-cited quiz for a study unit.
  app.post<{ Params: { unitId: string } }>("/api/units/:unitId/quiz", async (request, reply) => {
    if (!prisma) {
      return databaseUnavailable(reply);
    }
    const parsed = generateQuizSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid request body",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const unit = await prisma.studyUnit.findUnique({ where: { id: request.params.unitId } });
    if (!unit) {
      return reply.status(404).send({ error: `study unit not found: ${request.params.unitId}` });
    }
    if (unit.citationStart === null || unit.citationStart === undefined) {
      return reply.status(422).send({
        error:
          "study unit has no citation offsets; cannot map quiz evidence to its source revision",
      });
    }

    let result: Awaited<ReturnType<QuizProvider["generateQuiz"]>>;
    try {
      result = await quizProvider.generateQuiz({
        unit: { title: unit.title, content: unit.content },
        quizType: parsed.data.quizType,
        count: parsed.data.count,
      });
    } catch (err) {
      if (err instanceof QuizValidationError) {
        return reply.status(400).send({ error: err.message });
      }
      if (err instanceof QuizGenerationError) {
        return reply.status(502).send({ error: err.message });
      }
      throw err;
    }

    const persisted = await persistQuizDraft(prisma, {
      studyUnit: {
        id: unit.id,
        sourceRevisionId: unit.sourceRevisionId,
        citationStart: unit.citationStart,
      },
      quizType: parsed.data.quizType,
      title: `${unit.title} — ${parsed.data.quizType}`,
      result,
    });

    return reply.status(201).send({
      quizSetId: persisted.quizSetId,
      provider: quizProvider.name,
      items: result.items.map((item, index) => ({
        id: persisted.quizItemIds[index],
        prompt: item.prompt,
        difficulty: item.difficulty,
        citations: item.citations,
        choices: item.choices?.map(({ label, content }) => ({ label, content })),
      })),
    });
  });

  // Submit an attempt: grade, persist the raw Attempt, and on a wrong answer
  // open an ErrorEpisode (status open — cause attribution comes later).
  app.post<{ Params: { quizItemId: string } }>(
    "/api/quiz-items/:quizItemId/attempts",
    async (request, reply) => {
      if (!prisma) {
        return databaseUnavailable(reply);
      }
      const parsed = attemptSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "invalid request body",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      const item = await prisma.quizItem.findUnique({
        where: { id: request.params.quizItemId },
        include: { choices: true },
      });
      if (!item) {
        return reply
          .status(404)
          .send({ error: `quiz item not found: ${request.params.quizItemId}` });
      }
      const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
      if (!user) {
        return reply.status(404).send({ error: `user not found: ${parsed.data.userId}` });
      }

      const grading = gradeShortAnswer(
        { answer: item.answer, acceptedAnswers: item.acceptedAnswers },
        parsed.data.answer,
      );

      const attempt = await prisma.attempt.create({
        data: {
          userId: parsed.data.userId,
          quizItemId: item.id,
          submittedAnswer: parsed.data.answer,
          isCorrect: grading.isCorrect,
          latencyMs: parsed.data.latencyMs,
          confidence: parsed.data.confidence,
          gradingMethod: grading.gradingMethod,
        },
      });

      let errorEpisodeId: string | undefined;
      if (!grading.isCorrect) {
        const episode = await prisma.errorEpisode.create({
          data: {
            userId: parsed.data.userId,
            quizItemId: item.id,
            attemptId: attempt.id,
          },
        });
        errorEpisodeId = episode.id;
      }

      return reply.status(201).send({
        attemptId: attempt.id,
        isCorrect: grading.isCorrect,
        gradingMethod: grading.gradingMethod,
        // Never leak the expected answer on wrong attempts here; the client
        // fetches explanations through the review flow.
        errorEpisodeId,
      });
    },
  );
}
