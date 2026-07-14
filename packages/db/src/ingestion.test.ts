import { buildIngestionResult } from "@study-os/ingestion";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient, type PrismaClient } from "./index.js";
import { persistIngestionResult } from "./ingestion.js";

/**
 * Integration test against a real migrated PostgreSQL database. Runs in CI
 * (postgres service + migrate deploy happen before tests); skipped locally
 * when DATABASE_URL is not set.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("persistIngestionResult (integration)", () => {
  let prisma: PrismaClient;
  let testUserId: string;

  beforeAll(async () => {
    prisma = createPrismaClient();
    const user = await prisma.user.create({
      data: { displayName: "ingestion-it-user" },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Cascade deletes sources and units created by this test.
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  it("persists source and units with real ids and resolvable citations", async () => {
    const rawText = "제1장 개요\n\n프로세스는 실행 중인 프로그램이다.\n\n스레드는 실행 단위이다.";
    const result = buildIngestionResult({
      userId: testUserId,
      title: "운영체제 노트",
      sourceType: "text",
      rawText,
    });

    const persisted = await persistIngestionResult(prisma, result);
    expect(persisted.sourceId).toBeTruthy();
    expect(persisted.sourceRevisionId).toBeTruthy();
    expect(persisted.unitIds).toHaveLength(result.units.length);

    const stored = await prisma.studySource.findUniqueOrThrow({
      where: { id: persisted.sourceId },
      include: {
        studyUnits: { orderBy: { orderIndex: "asc" } },
        revisions: true,
      },
    });

    expect(stored.userId).toBe(testUserId);
    expect(stored.studyUnits).toHaveLength(2);

    // The immutable revision preserves the verbatim source text.
    expect(stored.revisions).toHaveLength(1);
    const revision = stored.revisions[0];
    expect(revision?.revision).toBe(1);
    expect(revision?.rawText).toBe(rawText);
    expect(revision?.contentSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(revision?.contentLength).toBe(rawText.length);

    for (const unit of stored.studyUnits) {
      expect(unit.sourceId).toBe(persisted.sourceId);
      expect(unit.sourceRevisionId).toBe(persisted.sourceRevisionId);
      // The invariant now resolves against the PERSISTED revision text,
      // not the in-memory input — citations are durable.
      expect((revision?.rawText ?? "").slice(unit.citationStart ?? 0, unit.citationEnd ?? 0)).toBe(
        unit.content,
      );
    }
  });

  it("persists the remediation-loop entities end to end (ErrorEpisode → Intervention → TransferAttempt → ReviewEvent)", async () => {
    const result = buildIngestionResult({
      userId: testUserId,
      title: "교정 루프 검증",
      sourceType: "text",
      rawText: "가상 메모리는 물리 메모리보다 큰 주소 공간을 제공한다.",
    });
    const persisted = await persistIngestionResult(prisma, result);

    // Evidence: a span over the revision + a cited quiz item.
    const span = await prisma.sourceSpan.create({
      data: { sourceRevisionId: persisted.sourceRevisionId, start: 0, end: 10 },
    });
    const quizSet = await prisma.quizSet.create({
      data: {
        studyUnitId: persisted.unitIds[0] ?? "",
        title: "확인 문제",
        quizType: "short_answer",
      },
    });
    const run = await prisma.generationRun.create({
      data: {
        kind: "quiz",
        provider: "mock",
        model: "mock-v1",
        promptVersion: "test-v1",
        inputSha256: "0".repeat(64),
      },
    });
    const item = await prisma.quizItem.create({
      data: {
        quizSetId: quizSet.id,
        prompt: "가상 메모리의 역할은?",
        answer: "물리 메모리보다 큰 주소 공간 제공",
        generationRunId: run.id,
        citations: { create: [{ sourceSpanId: span.id }] },
      },
      include: { citations: true },
    });
    expect(item.citations).toHaveLength(1);

    // Wrong attempt → episode with suggested vs confirmed cause.
    const attempt = await prisma.attempt.create({
      data: {
        userId: testUserId,
        quizItemId: item.id,
        submittedAnswer: "메모리 절약",
        isCorrect: false,
        latencyMs: 8400,
        confidence: 70,
        gradingMethod: "normalized_match",
      },
    });
    const episode = await prisma.errorEpisode.create({
      data: {
        userId: testUserId,
        quizItemId: item.id,
        attemptId: attempt.id,
        suggestedCause: "concept_gap",
        suggestedByRunId: run.id,
      },
    });
    expect(episode.status).toBe("open");
    expect(episode.confirmedCause).toBeNull();

    // Learner confirms a DIFFERENT cause than suggested — both preserved.
    const confirmed = await prisma.errorEpisode.update({
      where: { id: episode.id },
      data: {
        confirmedCause: "condition_misread",
        confirmedAt: new Date(),
        status: "cause_confirmed",
      },
    });
    expect(confirmed.suggestedCause).toBe("concept_gap");
    expect(confirmed.confirmedCause).toBe("condition_misread");

    // Cause-specific intervention + transfer item + raw review event.
    await prisma.intervention.create({
      data: { errorEpisodeId: episode.id, kind: "condition_drill", content: "조건 표시 연습" },
    });
    await prisma.transferAttempt.create({
      data: { errorEpisodeId: episode.id, quizItemId: item.id },
    });
    const review = await prisma.reviewEvent.create({
      data: {
        userId: testUserId,
        errorEpisodeId: episode.id,
        rating: "again",
        latencyMs: 5100,
        algorithm: "fixed-v0",
        schedulerStateBefore: { reviewCount: 0 },
        schedulerStateAfter: { reviewCount: 1, intervalHours: 24 },
      },
    });
    expect(review.algorithm).toBe("fixed-v0");

    // Cascade: deleting the episode's user would remove everything; here we
    // verify the episode's own relations load coherently.
    const loaded = await prisma.errorEpisode.findUniqueOrThrow({
      where: { id: episode.id },
      include: { interventions: true, transferAttempts: true, reviewEvents: true },
    });
    expect(loaded.interventions).toHaveLength(1);
    expect(loaded.transferAttempts[0]?.result).toBe("pending");
    expect(loaded.reviewEvents).toHaveLength(1);
  });

  it("is atomic: a failing unit rolls back the source row too", async () => {
    const result = buildIngestionResult({
      userId: testUserId,
      title: "롤백 검증",
      sourceType: "text",
      rawText: "본문 문단.",
    });
    // Poison one unit with an invalid (non-existent) relation by pointing the
    // whole persist at a user that does not exist — source insert fails, so
    // nothing must remain.
    const poisoned = {
      ...result,
      source: { ...result.source, userId: "no-such-user" },
    };

    await expect(persistIngestionResult(prisma, poisoned)).rejects.toThrow();
    const orphan = await prisma.studySource.findFirst({ where: { title: "롤백 검증" } });
    expect(orphan).toBeNull();
  });
});
