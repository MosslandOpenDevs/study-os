import type { ErrorNotebookEntry, StudyUnit } from "@study-os/core";
import type { PrismaClient } from "@study-os/db";
import { buildIngestionResult } from "@study-os/ingestion";
import { generateQuizDraft } from "@study-os/quiz-engine";
import { buildReviewTask } from "@study-os/scheduler";
import {
  createDefaultSummaryProvider,
  SummaryGenerationError,
  type SummaryProvider,
  SummaryValidationError,
  type TonePreset,
} from "@study-os/summary";
import Fastify, { type FastifyInstance } from "fastify";
import { registerSourceRoutes } from "./routes/sources.js";

export interface BuildAppOptions {
  logger?: boolean;
  /** Injectable for tests; defaults to Anthropic when ANTHROPIC_API_KEY is set, else mock. */
  summaryProvider?: SummaryProvider;
  /** Database client. When absent, database-backed routes return 503. */
  prisma?: PrismaClient;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });
  const summaryProvider = options.summaryProvider ?? createDefaultSummaryProvider();
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

  // Demo pipeline across all workspace packages. This route exists to prove at
  // runtime that @study-os/ingestion, quiz-engine, and scheduler resolve as
  // real declared dependencies (the previous scaffold crashed here with
  // ERR_MODULE_NOT_FOUND because they were only visible via tsconfig paths).
  app.get("/api/demo/study-loop", async () => {
    const ingestion = buildIngestionResult({
      userId: "demo-user",
      title: "샘플 강의",
      sourceType: "text",
      rawText: "첫 번째 개념 문단입니다.\n\n두 번째 개념 문단입니다.",
    });

    const firstUnit: StudyUnit = {
      id: "study-unit-1",
      sourceId: "demo-source",
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
      note: "첫 번째 개념 복습 필요",
      nextReviewAt: undefined,
      reviewCount: 0,
    };

    const reviewTask = buildReviewTask(notebookEntry);

    return { ingestion, quizDraft, reviewTask };
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
