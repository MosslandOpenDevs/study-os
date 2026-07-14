import type { PrismaClient } from "@study-os/db";
import { persistIngestionResult } from "@study-os/db";
import { buildIngestionResult, IngestionValidationError } from "@study-os/ingestion";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

/**
 * Study source upload API contract (issue #7) + persistence (issue #8).
 *
 * Text-only in M1 (PDF is M3). No auth yet: userId travels in the request
 * body/query and must reference an existing User row — authentication will
 * replace this before any public exposure.
 */

const createSourceSchema = z.object({
  userId: z.string().min(1),
  title: z.string().min(1).max(300),
  sourceType: z.enum(["text", "markdown"]),
  originalFilename: z.string().min(1).max(300).optional(),
  rawText: z.string().min(1).max(500_000),
});

const listSourcesSchema = z.object({
  userId: z.string().min(1),
});

/** Prisma FK violation (P2003): the referenced user does not exist. */
function isForeignKeyViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2003"
  );
}

function databaseUnavailable(reply: FastifyReply) {
  return reply.status(503).send({
    error: "database is not configured (set DATABASE_URL and start Postgres)",
  });
}

export function registerSourceRoutes(app: FastifyInstance, prisma: PrismaClient | undefined) {
  // Create a study source: ingest raw text into units and persist atomically.
  app.post("/api/sources", async (request, reply) => {
    if (!prisma) {
      return databaseUnavailable(reply);
    }
    const parsed = createSourceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid request body",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    let ingestion: ReturnType<typeof buildIngestionResult>;
    try {
      ingestion = buildIngestionResult(parsed.data);
    } catch (err) {
      if (err instanceof IngestionValidationError) {
        return reply.status(400).send({ error: err.message });
      }
      throw err;
    }

    try {
      const persisted = await persistIngestionResult(prisma, ingestion);
      return reply.status(201).send({
        sourceId: persisted.sourceId,
        unitIds: persisted.unitIds,
        unitCount: persisted.unitIds.length,
      });
    } catch (err) {
      if (isForeignKeyViolation(err)) {
        return reply.status(404).send({ error: `user not found: ${parsed.data.userId}` });
      }
      throw err;
    }
  });

  // List a user's sources with unit counts, newest first.
  app.get("/api/sources", async (request, reply) => {
    if (!prisma) {
      return databaseUnavailable(reply);
    }
    const parsed = listSourcesSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "userId query parameter is required" });
    }

    const sources = await prisma.studySource.findMany({
      where: { userId: parsed.data.userId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { studyUnits: true } } },
    });

    return {
      sources: sources.map((source) => ({
        id: source.id,
        title: source.title,
        sourceType: source.sourceType,
        originalFilename: source.originalFilename,
        createdAt: source.createdAt.toISOString(),
        unitCount: source._count.studyUnits,
      })),
    };
  });

  // Fetch one source with its units in document order (citations included).
  app.get<{ Params: { sourceId: string } }>("/api/sources/:sourceId", async (request, reply) => {
    if (!prisma) {
      return databaseUnavailable(reply);
    }
    const source = await prisma.studySource.findUnique({
      where: { id: request.params.sourceId },
      include: { studyUnits: { orderBy: { orderIndex: "asc" } } },
    });
    if (!source) {
      return reply.status(404).send({ error: `source not found: ${request.params.sourceId}` });
    }

    return {
      id: source.id,
      userId: source.userId,
      title: source.title,
      sourceType: source.sourceType,
      originalFilename: source.originalFilename,
      createdAt: source.createdAt.toISOString(),
      units: source.studyUnits.map((unit) => ({
        id: unit.id,
        title: unit.title,
        content: unit.content,
        orderIndex: unit.orderIndex,
        citationStart: unit.citationStart,
        citationEnd: unit.citationEnd,
      })),
    };
  });
}
