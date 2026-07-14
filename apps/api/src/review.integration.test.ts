import { createPrismaClient, type PrismaClient } from "@study-os/db";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

/**
 * Review scheduling API (#5) against real Postgres in CI: FSRS review
 * recording with raw-event preservation, and the prioritized daily queue.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("review API (integration)", () => {
  let prisma: PrismaClient;
  let app: FastifyInstance;
  let userId: string;
  let episodeId: string;
  let recurringEpisodeId: string;

  beforeAll(async () => {
    prisma = createPrismaClient();
    app = buildApp({ prisma });

    const user = await prisma.user.create({ data: { displayName: "review-it-user" } });
    userId = user.id;

    // Minimal graph: source → revision → unit → quiz item → 2 wrong attempts
    // → 2 episodes (one with a failed transfer = recurring).
    const source = await prisma.studySource.create({
      data: { userId, title: "리뷰 테스트 소스", sourceType: "text" },
    });
    const revision = await prisma.sourceRevision.create({
      data: {
        sourceId: source.id,
        revision: 1,
        rawText: "테스트 본문",
        contentSha256: "0".repeat(64),
        contentLength: 6,
      },
    });
    const unit = await prisma.studyUnit.create({
      data: {
        sourceId: source.id,
        sourceRevisionId: revision.id,
        title: "유닛",
        content: "테스트 본문",
        orderIndex: 0,
      },
    });
    const quizSet = await prisma.quizSet.create({
      data: { studyUnitId: unit.id, title: "세트", quizType: "short_answer" },
    });
    const item = await prisma.quizItem.create({
      data: { quizSetId: quizSet.id, prompt: "문제?", answer: "정답" },
    });

    const makeEpisode = async () => {
      const attempt = await prisma.attempt.create({
        data: { userId, quizItemId: item.id, submittedAnswer: "오답", isCorrect: false },
      });
      return prisma.errorEpisode.create({
        data: { userId, quizItemId: item.id, attemptId: attempt.id },
      });
    };

    episodeId = (await makeEpisode()).id;
    const recurring = await makeEpisode();
    recurringEpisodeId = recurring.id;
    await prisma.transferAttempt.create({
      data: { errorEpisodeId: recurringEpisodeId, quizItemId: item.id, result: "failed" },
    });
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
    await prisma.$disconnect();
  });

  it("both fresh episodes appear in the queue; the recurring one outranks", async () => {
    const res = await app.inject({ method: "GET", url: `/api/review/queue?userId=${userId}` });
    expect(res.statusCode).toBe(200);

    const { queue } = res.json();
    expect(queue).toHaveLength(2);
    expect(queue[0].errorEpisodeId).toBe(recurringEpisodeId);
    expect(queue[0].recurrenceCount).toBe(1);
    expect(queue[1].errorEpisodeId).toBe(episodeId);
  });

  it("POST /api/review/events applies FSRS and preserves the raw event", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/review/events",
      payload: { userId, errorEpisodeId: episodeId, rating: "good", latencyMs: 4200 },
    });
    expect(res.statusCode).toBe(201);

    const body = res.json();
    expect(body.algorithm).toMatch(/^ts-fsrs /);
    expect(new Date(body.nextDue).getTime()).toBeGreaterThan(Date.now());

    const event = await prisma.reviewEvent.findUniqueOrThrow({
      where: { id: body.reviewEventId },
    });
    expect(event.rating).toBe("good");
    expect(event.latencyMs).toBe(4200);
    expect(event.algorithm).toBe(body.algorithm);
    // First review: before-state is the explicit initial (never-reviewed)
    // card, so recomputation can always start from a concrete snapshot.
    expect(event.schedulerStateBefore).toMatchObject({ reps: 0 });
    expect(event.schedulerStateAfter).toMatchObject({ reps: 1 });
    expect(event.scheduledAt?.toISOString()).toBe(body.nextDue);
  });

  it("a reviewed (not-yet-due) episode drops out of the queue", async () => {
    const res = await app.inject({ method: "GET", url: `/api/review/queue?userId=${userId}` });
    const { queue } = res.json();
    expect(queue.map((i: { errorEpisodeId: string }) => i.errorEpisodeId)).toEqual([
      recurringEpisodeId,
    ]);
  });

  it("a second review chains from the stored after-state", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/review/events",
      payload: { userId, errorEpisodeId: episodeId, rating: "again" },
    });
    expect(res.statusCode).toBe(201);

    const events = await prisma.reviewEvent.findMany({
      where: { errorEpisodeId: episodeId },
      orderBy: { reviewedAt: "asc" },
    });
    expect(events).toHaveLength(2);
    // Raw-event chain: second event's before-state equals first's after-state.
    expect(events[1]?.schedulerStateBefore).toEqual(events[0]?.schedulerStateAfter);
    // Note: FSRS-6 does not count a lapse for an "again" on a card still in
    // the learning phase — assert the rep count, not lapses.
    expect(events[1]?.schedulerStateAfter).toMatchObject({ reps: 2 });
  });

  it("404s for an unknown episode and 400s for a bad rating", async () => {
    const notFound = await app.inject({
      method: "POST",
      url: "/api/review/events",
      payload: { userId, errorEpisodeId: "nope", rating: "good" },
    });
    expect(notFound.statusCode).toBe(404);

    const badRating = await app.inject({
      method: "POST",
      url: "/api/review/events",
      payload: { userId, errorEpisodeId: episodeId, rating: "perfect" },
    });
    expect(badRating.statusCode).toBe(400);
  });
});
