import type { IngestionResult } from "@study-os/ingestion";
import type { PrismaClient } from "./generated/prisma/client.js";

export interface PersistedIngestion {
  sourceId: string;
  unitIds: string[];
}

/**
 * Persists an IngestionResult atomically: the StudySource row and all
 * StudyUnit rows (with their citation offsets) are written in one
 * transaction, and every unit receives the REAL sourceId — this is the
 * counterpart to @study-os/ingestion no longer fabricating placeholder ids.
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

    const unitIds: string[] = [];
    for (const unit of result.units) {
      const created = await tx.studyUnit.create({
        data: {
          sourceId: source.id,
          title: unit.title,
          content: unit.content,
          orderIndex: unit.orderIndex,
          citationStart: unit.citationStart,
          citationEnd: unit.citationEnd,
        },
      });
      unitIds.push(created.id);
    }

    return { sourceId: source.id, unitIds };
  });
}
