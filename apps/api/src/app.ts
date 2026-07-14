import type { ErrorNotebookEntry, StudyUnit } from "@study-os/core";
import { buildIngestionResult } from "@study-os/ingestion";
import { generateQuizDraft } from "@study-os/quiz-engine";
import { buildReviewTask } from "@study-os/scheduler";
import Fastify, { type FastifyInstance } from "fastify";

export interface BuildAppOptions {
  logger?: boolean;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });

  app.get("/", async () => ({
    name: "study-os-api",
    status: "pre-alpha",
  }));

  // Liveness: the process is up and the event loop responds.
  app.get("/healthz", async () => ({ status: "ok" }));

  // Readiness: the server can serve traffic. No external dependencies exist
  // yet; once a database is wired in (M1), this must also verify connectivity.
  app.get("/readyz", async () => ({ status: "ready" }));

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

  return app;
}
