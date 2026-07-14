import { createHash } from "node:crypto";
import type { IngestionResult } from "@study-os/ingestion";
import type { PrismaClient } from "./generated/prisma/client.js";

export interface PersistedIngestion {
  sourceId: string;
  sourceRevisionId: string;
  unitIds: string[];
}

/**
 * Persists an IngestionResult atomically: the StudySource row, an immutable
 * SourceRevision holding the verbatim rawText (the ground truth every
 * citation offset resolves against), and all StudyUnit rows — in one
 * transaction, with real foreign keys throughout.
 */
export async function persistIngestionResult(
  prisma: PrismaClient,
  result: IngestionResult,
): Promise<PersistedIngestion> {
  return prisma.$transaction(async (tx) => {
    const source = await tx.studySource.create({
      data: {
        userId: result.source.userId,
        title: result.source.title,
        sourceType: result.source.sourceType,
        originalFilename: result.source.originalFilename,
      },
    });

    const revision = await tx.sourceRevision.create({
      data: {
        sourceId: source.id,
        revision: 1,
        rawText: result.rawText,
        contentSha256: createHash("sha256").update(result.rawText, "utf8").digest("hex"),
        contentLength: result.rawText.length,
      },
    });

    const unitIds: string[] = [];
    for (const unit of result.units) {
      const created = await tx.studyUnit.create({
        data: {
          sourceId: source.id,
          sourceRevisionId: revision.id,
          title: unit.title,
          content: unit.content,
          orderIndex: unit.orderIndex,
          citationStart: unit.citationStart,
          citationEnd: unit.citationEnd,
        },
      });
      unitIds.push(created.id);
    }

    return { sourceId: source.id, sourceRevisionId: revision.id, unitIds };
  });
}
