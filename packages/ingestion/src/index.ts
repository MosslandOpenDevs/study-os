import type { StudyMaterialType } from "@study-os/core";

export class IngestionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IngestionValidationError";
  }
}

export interface IngestionRequest {
  userId: string;
  title: string;
  sourceType: StudyMaterialType;
  originalFilename?: string;
  rawText: string;
}

/**
 * A study unit draft produced by segmentation. `citationStart`/`citationEnd`
 * are UTF-16 code-unit offsets into the ORIGINAL `rawText` such that
 * `rawText.slice(citationStart, citationEnd) === content` — every unit is
 * always resolvable back to its exact source evidence.
 */
export interface IngestionUnitDraft {
  title: string;
  content: string;
  orderIndex: number;
  citationStart: number;
  citationEnd: number;
}

export interface IngestionResult {
  source: {
    userId: string;
    title: string;
    sourceType: StudyMaterialType;
    originalFilename?: string;
  };
  /**
   * Unit drafts WITHOUT database ids. Assigning a real sourceId is the
   * persister's job (see @study-os/db persistIngestionResult) — this package
   * no longer fabricates placeholder ids.
   */
  units: IngestionUnitDraft[];
}

const MAX_UNITS = 500;
const MAX_TITLE_LENGTH = 80;

/**
 * Heading detectors, tried per line. Cover Markdown headings and common
 * Korean textbook/exam-material conventions.
 */
const HEADING_PATTERNS: RegExp[] = [
  /^#{1,6}\s+(.+)$/, // Markdown: # 제목
  /^(제\s*\d+\s*[장절편부과][.)]?\s*.*)$/, // 제1장 프로세스 관리
  /^(\d+(?:\.\d+)*[.)]\s+.+)$/, // 1. 개요 / 1.1. 상세 / 2) 항목
  /^(\d+(?:\.\d+)+\.?\s+.+)$/, // 1.1 배경 (multi-level, no trailing dot)
  /^([IVXLC]+\.\s+.+)$/, // I. 서론
  /^([가-힣]\.\s+.+)$/, // 가. 세부 항목
];

function matchHeading(line: string): string | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return null;
  }
  for (const pattern of HEADING_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      const captured = match[1] ?? trimmed;
      return captured.replace(/^#{1,6}\s+/, "").trim();
    }
  }
  return null;
}

function truncateTitle(title: string): string {
  return title.length > MAX_TITLE_LENGTH ? `${title.slice(0, MAX_TITLE_LENGTH - 1)}…` : title;
}

interface Region {
  /** Heading text this region belongs to, if any. */
  heading: string | null;
  start: number;
  end: number;
}

/**
 * Splits rawText into heading-delimited regions. Offsets always refer to the
 * original string; the text is never normalized or rewritten.
 */
function splitByHeadings(rawText: string): Region[] {
  const regions: Region[] = [];
  const lineRegex = /[^\n]*(?:\n|$)/g;

  let currentHeading: string | null = null;
  let regionStart = 0;
  let sawAnyLine = false;

  for (const match of rawText.matchAll(lineRegex)) {
    const line = match[0];
    if (line.length === 0) {
      break; // Terminal empty match at end of input.
    }
    const lineStart = match.index;
    const heading = matchHeading(line);
    if (heading !== null) {
      if (sawAnyLine) {
        regions.push({ heading: currentHeading, start: regionStart, end: lineStart });
      }
      currentHeading = heading;
      regionStart = lineStart + line.length; // Body starts after the heading line.
    }
    sawAnyLine = true;
  }
  regions.push({ heading: currentHeading, start: regionStart, end: rawText.length });

  return regions.filter((region) => rawText.slice(region.start, region.end).trim().length > 0);
}

/**
 * Splits a region into paragraphs on blank lines, emitting exact offsets of
 * each paragraph's trimmed extent within the original string.
 */
function splitRegionIntoParagraphs(
  rawText: string,
  region: Region,
): Array<{ start: number; end: number }> {
  const body = rawText.slice(region.start, region.end);
  const paragraphs: Array<{ start: number; end: number }> = [];
  const separator = /\n[ \t\r]*\n+/g;

  let cursor = 0;
  const flush = (rawStart: number, rawEnd: number) => {
    const segment = body.slice(rawStart, rawEnd);
    const leading = segment.length - segment.trimStart().length;
    const trailing = segment.length - segment.trimEnd().length;
    const start = region.start + rawStart + leading;
    const end = region.start + rawEnd - trailing;
    if (end > start) {
      paragraphs.push({ start, end });
    }
  };

  for (const match of body.matchAll(separator)) {
    flush(cursor, match.index);
    cursor = match.index + match[0].length;
  }
  flush(cursor, body.length);

  return paragraphs;
}

/**
 * Deterministic segmentation of source text into study-unit drafts with
 * citation offsets. Same input always yields identical output.
 */
export function segmentText(rawText: string, documentTitle: string): IngestionUnitDraft[] {
  const units: IngestionUnitDraft[] = [];

  for (const region of splitByHeadings(rawText)) {
    const paragraphs = splitRegionIntoParagraphs(rawText, region);
    const baseTitle = region.heading ?? documentTitle;

    paragraphs.forEach((paragraph, indexInRegion) => {
      const title =
        paragraphs.length === 1 ? baseTitle : `${baseTitle} - Part ${indexInRegion + 1}`;
      units.push({
        title: truncateTitle(title),
        content: rawText.slice(paragraph.start, paragraph.end),
        orderIndex: units.length,
        citationStart: paragraph.start,
        citationEnd: paragraph.end,
      });
    });
  }

  return units;
}

export function buildIngestionResult(request: IngestionRequest): IngestionResult {
  const title = request.title.trim();
  if (request.userId.trim().length === 0) {
    throw new IngestionValidationError("userId must not be empty");
  }
  if (title.length === 0) {
    throw new IngestionValidationError("title must not be empty");
  }
  if (request.rawText.trim().length === 0) {
    throw new IngestionValidationError("rawText must not be empty");
  }

  const units = segmentText(request.rawText, title);
  if (units.length === 0) {
    throw new IngestionValidationError("rawText produced no study units");
  }
  if (units.length > MAX_UNITS) {
    throw new IngestionValidationError(
      `rawText produced ${units.length} units, exceeding the limit of ${MAX_UNITS}`,
    );
  }

  return {
    source: {
      userId: request.userId,
      title,
      sourceType: request.sourceType,
      originalFilename: request.originalFilename,
    },
    units,
  };
}
