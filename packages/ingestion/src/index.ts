import type { StudyMaterialType, StudySource, StudyUnit } from "@study-os/core";

export interface IngestionRequest {
  userId: string;
  title: string;
  sourceType: StudyMaterialType;
  originalFilename?: string;
  rawText: string;
}

export interface IngestionChunk {
  title: string;
  content: string;
  orderIndex: number;
  citationStart?: number;
  citationEnd?: number;
}

export interface IngestionResult {
  source: Omit<StudySource, "id" | "createdAt">;
  units: Array<Omit<StudyUnit, "id">>;
}

export function splitIntoStudyUnits(request: IngestionRequest): IngestionChunk[] {
  const normalized = request.rawText
    .split(/\n\s*\n/g)
    .map((part) => part.trim())
    .filter(Boolean);

  return normalized.map((content, index) => ({
    title: `${request.title} - Part ${index + 1}`,
    content,
    orderIndex: index,
  }));
}

export function buildIngestionResult(request: IngestionRequest): IngestionResult {
  const units = splitIntoStudyUnits(request).map((chunk) => ({
    sourceId: "pending-source-id",
    title: chunk.title,
    content: chunk.content,
    orderIndex: chunk.orderIndex,
    citationStart: chunk.citationStart,
    citationEnd: chunk.citationEnd,
  }));

  return {
    source: {
      userId: request.userId,
      title: request.title,
      sourceType: request.sourceType,
      originalFilename: request.originalFilename,
      storageUrl: undefined,
    },
    units,
  };
}
