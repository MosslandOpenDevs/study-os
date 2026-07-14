import { createPrismaClient, type PrismaClient } from "@study-os/db";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

/**
 * Full text-only loop against real Postgres in CI:
 * upload → units → evidence-cited quiz → graded attempt →
 * auto-opened ErrorEpisode → review queue.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

const RAW_TEXT = `제1장 메모리 관리

가상 메모리는 물리 메모리보다 큰 주소 공간을 제공한다. 페이지 단위로 관리된다.

스레드는 프로세스 내부의 실행 흐름이며 같은 주소 공간을 공유한다.`;

describe.skipIf(!hasDatabase)("quiz generation + attempt loop (integration)", () => {
  let prisma: PrismaClient;
  let app: FastifyInstance;
  let userId: string;
  let unitId: string;
  let quizItemId: string;
  let correctAnswer: string;

  beforeAll(async () => {
    prisma = createPrismaClient();
    app = buildApp({ prisma }); // default provider: mock (no ANTHROPIC_API_KEY in CI)

    const user = await prisma.user.create({ data: { displayName: "quiz-it-user" } });
    userId = user.id;

    const upload = await app.inject({
      method: "POST",
      url: "/api/sources",
      payload: { userId, title: "운영체제 노트", sourceType: "text", rawText: RAW_TEXT },
    });
    expect(upload.statusCode).toBe(201);
    unitId = upload.json().unitIds[0];
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
    await prisma.$disconnect();
  });

  it("POST /api/units/:unitId/quiz generates, persists, and returns cited items", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/units/${unitId}/quiz`,
      payload: { quizType: "short-answer", count: 2 },
    });
    expect(res.statusCode).toBe(201);

    const body = res.json();
    expect(body.provider).toBe("mock");
    expect(body.items).toHaveLength(2);
    for (const item of body.items) {
      expect(item.id).toBeTruthy();
      expect(item.citations.length).toBeGreaterThan(0);
    }
    quizItemId = body.items[0].id;

    // Evidence chain: QuizItemCitation → SourceSpan → SourceRevision.rawText.
    const stored = await prisma.quizItem.findUniqueOrThrow({
      where: { id: quizItemId },
      include: {
        citations: { include: { sourceSpan: { include: { sourceRevision: true } } } },
        generationRun: true,
      },
    });
    correctAnswer = stored.answer;

    expect(stored.generationRun?.kind).toBe("quiz");
    expect(stored.generationRun?.provider).toBe("mock");
    expect(stored.citations.length).toBeGreaterThan(0);
    for (const citation of stored.citations) {
      const span = citation.sourceSpan;
      const resolved = span.sourceRevision.rawText.slice(span.start, span.end);
      // Revision-mapped spans must resolve to real source text.
      expect(resolved.length).toBeGreaterThan(0);
      expect(RAW_TEXT).toContain(resolved);
    }
  });

  it("a wrong attempt opens an ErrorEpisode and reports normalized grading", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/quiz-items/${quizItemId}/attempts`,
      payload: { userId, answer: "완전히 틀린 답", latencyMs: 7200, confidence: 40 },
    });
    expect(res.statusCode).toBe(201);

    const body = res.json();
    expect(body.isCorrect).toBe(false);
    expect(body.gradingMethod).toBe("normalized_match");
    expect(body.errorEpisodeId).toBeTruthy();

    const episode = await prisma.errorEpisode.findUniqueOrThrow({
      where: { id: body.errorEpisodeId },
    });
    expect(episode.status).toBe("open");
    expect(episode.quizItemId).toBe(quizItemId);
  });

  it("the auto-opened episode shows up in the review queue", async () => {
    const res = await app.inject({ method: "GET", url: `/api/review/queue?userId=${userId}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().queue.some((entry: { errorEpisodeId: string }) => entry.errorEpisodeId)).toBe(
      true,
    );
  });

  it("a correct answer with formatting noise passes normalized grading, no episode", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/quiz-items/${quizItemId}/attempts`,
      payload: { userId, answer: `  ${correctAnswer}.  ` },
    });
    expect(res.statusCode).toBe(201);

    const body = res.json();
    expect(body.isCorrect).toBe(true);
    expect(body.errorEpisodeId).toBeUndefined();
  });

  it("404s and 400s are mapped correctly", async () => {
    const badUnit = await app.inject({
      method: "POST",
      url: "/api/units/nonexistent/quiz",
      payload: { quizType: "short-answer", count: 1 },
    });
    expect(badUnit.statusCode).toBe(404);

    const badType = await app.inject({
      method: "POST",
      url: `/api/units/${unitId}/quiz`,
      payload: { quizType: "essay", count: 1 },
    });
    expect(badType.statusCode).toBe(400);

    const badItem = await app.inject({
      method: "POST",
      url: "/api/quiz-items/nonexistent/attempts",
      payload: { userId, answer: "x" },
    });
    expect(badItem.statusCode).toBe(404);
  });
});
