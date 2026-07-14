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
    expect(persisted.unitIds).toHaveLength(result.units.length);

    const stored = await prisma.studySource.findUniqueOrThrow({
      where: { id: persisted.sourceId },
      include: { studyUnits: { orderBy: { orderIndex: "asc" } } },
    });

    expect(stored.userId).toBe(testUserId);
    expect(stored.studyUnits).toHaveLength(2);
    for (const unit of stored.studyUnits) {
      expect(unit.sourceId).toBe(persisted.sourceId);
      expect(unit.sourceId).not.toBe("pending-source-id");
      // The invariant survives the database round-trip.
      expect(rawText.slice(unit.citationStart ?? 0, unit.citationEnd ?? 0)).toBe(unit.content);
    }
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
