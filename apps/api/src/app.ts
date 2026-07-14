import type { PrismaClient } from "@study-os/db";
import { buildIngestionResult } from "@study-os/ingestion";
import { createDefaultQuizProvider, type QuizProvider } from "@study-os/quiz-engine";
import { applyReview } from "@study-os/scheduler";
import {
  createDefaultSummaryProvider,
  SummaryGenerationError,
  type SummaryProvider,
  SummaryValidationError,
  type TonePreset,
} from "@study-os/summary";
import Fastify, { type FastifyInstance } from "fastify";
import { registerQuizRoutes } from "./routes/quiz.js";
import { registerReviewRoutes } from "./routes/review.js";
import { registerSourceRoutes } from "./routes/sources.js";

export interface BuildAppOptions {
  logger?: boolean;
  /** Injectable for tests; defaults to Anthropic when ANTHROPIC_API_KEY is set, else mock. */
  summaryProvider?: SummaryProvider;
  /** Injectable for tests; defaults to Anthropic when ANTHROPIC_API_KEY is set, else mock. */
  quizProvider?: QuizProvider;
  /** Database client. When absent, database-backed routes return 503. */
  prisma?: PrismaClient;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });
  const summaryProvider = options.summaryProvider ?? createDefaultSummaryProvider();
  const quizProvider = options.quizProvider ?? createDefaultQuizProvider();
  const prisma = options.prisma;

  app.get("/", async () => ({
    name: "study-os-api",
    status: "pre-alpha",
  }));

  // Liveness: the process is up and the event loop responds.
  app.get("/healthz", async () => ({ status: "ok" }));

  // Readiness: when a database is configured it must actually answer;
  // without one the API is still "ready" for its database-less routes.
  app.get("/readyz", async (_request, reply) => {
    if (prisma) {
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch {
        return reply.status(503).send({ status: "unavailable", reason: "database unreachable" });
      }
      return { status: "ready", database: "ok" };
    }
    return { status: "ready" };
  });

  registerSourceRoutes(app, prisma);
  registerReviewRoutes(app, prisma);
  registerQuizRoutes(app, prisma, quizProvider);

  // Demo pipeline across all workspace packages. This route exists to prove at
  // runtime that @study-os/ingestion, quiz-engine, and scheduler resolve as
  // real declared dependencies (the previous scaffold crashed here with
  // ERR_MODULE_NOT_FOUND because they were only visible via tsconfig paths).
  app.get("/api/demo/study-loop", async () => {
    const ingestion = buildIngestionResult({
      userId: "demo-user",
      title: "샘플 강의",
      sourceType: "text",
      rawText:
        "프로세스는 실행 중인 프로그램이며 운영체제 자원 배분의 기본 단위입니다.\n\n스레드는 프로세스 내부의 실행 흐름이며 같은 주소 공간을 공유합니다.",
    });

    const firstUnit = ingestion.units[0];
    const quiz = await quizProvider.generateQuiz({
      unit: { title: firstUnit?.title ?? "샘플", content: firstUnit?.content ?? "" },
      quizType: "short-answer",
      count: 2,
    });
    const quizDraft = quiz.items;

    // First FSRS review of a fresh card: proves the scheduler resolves and
    // schedules at runtime.
    const review = applyReview(null, "good", new Date());

    return {
      ingestion,
      quizDraft,
      review: {
        algorithm: review.algorithm,
        nextDue: review.due.toISOString(),
        reps: review.after.reps,
      },
    };
  });

  // Korean summary generation for a study unit (issues #10/#4). Uses the
  // configured SummaryProvider — deterministic mock without ANTHROPIC_API_KEY,
  // Claude-backed with it. Fail-closed: invalid input → 400, generation
  // failure or insufficient evidence → 502; never a fabricated summary.
  app.post<{
    Body: { title?: string; content?: string; tonePreset?: TonePreset };
  }>("/api/demo/summary", async (request, reply) => {
    const { title, content, tonePreset } = request.body ?? {};
    if (typeof title !== "string" || typeof content !== "string") {
      return reply.status(400).send({ error: "title and content are required strings" });
    }
    if (tonePreset !== undefined && !["teacher", "tutor", "concise-exam"].includes(tonePreset)) {
      return reply.status(400).send({ error: "tonePreset must be teacher|tutor|concise-exam" });
    }

    try {
      const card = await summaryProvider.generateSummary({
        unit: { title, content },
        tonePreset,
      });
      return { provider: summaryProvider.name, card };
    } catch (err) {
      if (err instanceof SummaryValidationError) {
        return reply.status(400).send({ error: err.message });
      }
      if (err instanceof SummaryGenerationError) {
        return reply.status(502).send({ error: err.message });
      }
      throw err;
    }
  });

  return app;
}
