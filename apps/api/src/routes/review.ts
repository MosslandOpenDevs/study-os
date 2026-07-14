import type { PrismaClient } from "@study-os/db";
import {
  applyReview,
  buildDailyQueue,
  initialCardState,
  type ReviewQueueInput,
  type SchedulerCardState,
  SchedulerValidationError,
} from "@study-os/scheduler";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

/**
 * Review scheduling API (issue #5): FSRS-backed review recording and the
 * prioritized daily queue. Raw ReviewEvents preserve rating, latency,
 * algorithm version, and opaque before/after scheduler state so schedules
 * can always be recomputed.
 */

const recordReviewSchema = z.object({
  userId: z.string().min(1),
  errorEpisodeId: z.string().min(1),
  rating: z.enum(["again", "hard", "good", "easy"]),
  latencyMs: z.number().int().nonnegative().optional(),
});

const queueQuerySchema = z.object({
  userId: z.string().min(1),
});

/** Statuses that keep an episode in the review loop. */
const ACTIVE_STATUSES = ["open", "cause_confirmed", "intervened"] as const;

function databaseUnavailable(reply: FastifyReply) {
  return reply.status(503).send({
    error: "database is not configured (set DATABASE_URL and start Postgres)",
  });
}

function latestState(
  events: Array<{ schedulerStateAfter: unknown }>,
  fallbackCreatedAt: Date,
): SchedulerCardState {
  const raw = events[0]?.schedulerStateAfter;
  if (raw && typeof raw === "object") {
    return raw as SchedulerCardState;
  }
  // Never reviewed: due immediately, anchored at episode creation.
  return initialCardState(fallbackCreatedAt);
}

export function registerReviewRoutes(app: FastifyInstance, prisma: PrismaClient | undefined) {
  // Record one review: apply FSRS and append the raw event.
  app.post("/api/review/events", async (request, reply) => {
    if (!prisma) {
      return databaseUnavailable(reply);
    }
    const parsed = recordReviewSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid request body",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    const { userId, errorEpisodeId, rating, latencyMs } = parsed.data;

    const episode = await prisma.errorEpisode.findUnique({
      where: { id: errorEpisodeId },
      include: { reviewEvents: { orderBy: { reviewedAt: "desc" }, take: 1 } },
    });
    if (!episode || episode.userId !== userId) {
      return reply.status(404).send({ error: `error episode not found: ${errorEpisodeId}` });
    }

    const now = new Date();
    let application: ReturnType<typeof applyReview>;
    try {
      application = applyReview(latestState(episode.reviewEvents, episode.createdAt), rating, now);
    } catch (err) {
      if (err instanceof SchedulerValidationError) {
        return reply.status(422).send({ error: `stored scheduler state invalid: ${err.message}` });
      }
      throw err;
    }

    // States are opaque JSON snapshots by contract — serialize them as such.
    const event = await prisma.reviewEvent.create({
      data: {
        userId,
        errorEpisodeId,
        rating,
        latencyMs,
        algorithm: application.algorithm,
        schedulerStateBefore: application.before
          ? JSON.parse(JSON.stringify(application.before))
          : undefined,
        schedulerStateAfter: JSON.parse(JSON.stringify(application.after)),
        scheduledAt: application.due,
        reviewedAt: now,
      },
    });

    return reply.status(201).send({
      reviewEventId: event.id,
      algorithm: application.algorithm,
      nextDue: application.due.toISOString(),
    });
  });

  // Prioritized daily queue: due/overdue episodes, recurring errors first.
  app.get("/api/review/queue", async (request, reply) => {
    if (!prisma) {
      return databaseUnavailable(reply);
    }
    const parsed = queueQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "userId query parameter is required" });
    }

    const episodes = await prisma.errorEpisode.findMany({
      where: { userId: parsed.data.userId, status: { in: [...ACTIVE_STATUSES] } },
      include: {
        reviewEvents: { orderBy: { reviewedAt: "desc" }, take: 1 },
        transferAttempts: { where: { result: "failed" }, select: { id: true } },
      },
    });

    const inputs: ReviewQueueInput[] = episodes.map((episode) => ({
      errorEpisodeId: episode.id,
      state: latestState(episode.reviewEvents, episode.createdAt),
      confirmedCause: episode.confirmedCause,
      recurrenceCount: episode.transferAttempts.length,
    }));

    try {
      const queue = buildDailyQueue(inputs, new Date());
      return {
        queue: queue.map((item) => ({
          errorEpisodeId: item.errorEpisodeId,
          due: item.due.toISOString(),
          overdueMinutes: item.overdueMinutes,
          recurrenceCount: item.recurrenceCount,
          confirmedCause: item.confirmedCause,
          priority: item.priority,
        })),
      };
    } catch (err) {
      if (err instanceof SchedulerValidationError) {
        return reply.status(422).send({ error: `stored scheduler state invalid: ${err.message}` });
      }
      throw err;
    }
  });
}
