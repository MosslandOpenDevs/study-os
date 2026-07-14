import { describe, expect, it } from "vitest";
import {
  buildIngestionResult,
  type IngestionResult,
  IngestionValidationError,
  segmentText,
} from "./index.js";

/** Core invariant: every unit's content is the exact source substring. */
function expectSpansResolve(rawText: string, result: IngestionResult) {
  for (const unit of result.units) {
    expect(rawText.slice(unit.citationStart, unit.citationEnd)).toBe(unit.content);
    expect(unit.citationEnd).toBeGreaterThan(unit.citationStart);
  }
}

const KOREAN_FIXTURE = `제1장 프로세스 관리

프로세스는 실행 중인 프로그램이다. 운영체제는 프로세스에 CPU 시간을 배분한다.

스레드는 프로세스 내부의 실행 단위이며, 같은 주소 공간을 공유한다.

제2장 메모리 관리

가상 메모리는 물리 메모리보다 큰 주소 공간을 제공한다.`;

describe("segmentText — Korean fixture", () => {
  it("splits on Korean chapter headings and paragraphs, in document order", () => {
    const units = segmentText(KOREAN_FIXTURE, "운영체제");

    expect(units.map((u) => u.title)).toEqual([
      "제1장 프로세스 관리 - Part 1",
      "제1장 프로세스 관리 - Part 2",
      "제2장 메모리 관리",
    ]);
    expect(units.map((u) => u.orderIndex)).toEqual([0, 1, 2]);
    expect(units[0]?.content).toContain("프로세스는 실행 중인 프로그램이다");
    expect(units[1]?.content).toContain("스레드는 프로세스 내부의 실행 단위");
    expect(units[2]?.content).toContain("가상 메모리는 물리 메모리보다");
  });

  it("every unit's citation offsets resolve to its exact content", () => {
    const result = buildIngestionResult({
      userId: "u1",
      title: "운영체제",
      sourceType: "text",
      rawText: KOREAN_FIXTURE,
    });
    expectSpansResolve(KOREAN_FIXTURE, result);
  });

  it("is deterministic: identical input yields identical output", () => {
    const a = segmentText(KOREAN_FIXTURE, "운영체제");
    const b = segmentText(KOREAN_FIXTURE, "운영체제");
    expect(a).toEqual(b);
  });
});

describe("segmentText — heading conventions", () => {
  it("recognizes Markdown headings", () => {
    const raw = "# 개요\n\n첫 문단.\n\n## 상세\n\n둘째 문단.";
    const units = segmentText(raw, "문서");
    expect(units.map((u) => u.title)).toEqual(["개요", "상세"]);
  });

  it("recognizes numbered headings (1. / 1.1)", () => {
    const raw = "1. 서론\n\n서론 내용입니다.\n\n1.1 배경\n\n배경 내용입니다.";
    const units = segmentText(raw, "문서");
    expect(units.map((u) => u.title)).toEqual(["1. 서론", "1.1 배경"]);
  });

  it("recognizes 가나다 item headings", () => {
    const raw = "가. 첫 항목\n\n내용 하나.\n\n나. 둘째 항목\n\n내용 둘.";
    const units = segmentText(raw, "문서");
    expect(units.map((u) => u.title)).toEqual(["가. 첫 항목", "나. 둘째 항목"]);
  });

  it("keeps preamble text before the first heading, titled by the document", () => {
    const raw = "머리말 문단입니다.\n\n제1장 시작\n\n본문입니다.";
    const units = segmentText(raw, "교재");
    expect(units.map((u) => u.title)).toEqual(["교재", "제1장 시작"]);
  });

  it("falls back to document-title parts when there are no headings", () => {
    const raw = "첫 문단.\n\n둘째 문단.";
    const units = segmentText(raw, "노트");
    expect(units.map((u) => u.title)).toEqual(["노트 - Part 1", "노트 - Part 2"]);
  });
});

describe("segmentText — offsets and whitespace", () => {
  it("resolves offsets exactly with CRLF line endings", () => {
    const raw = "제1장 개요\r\n\r\n첫 문단입니다.\r\n\r\n둘째 문단입니다.";
    const units = segmentText(raw, "문서");
    expect(units).toHaveLength(2);
    for (const unit of units) {
      expect(raw.slice(unit.citationStart, unit.citationEnd)).toBe(unit.content);
      expect(unit.content).not.toMatch(/[\r\n]$/);
    }
  });

  it("excludes surrounding whitespace from spans", () => {
    const raw = "   앞뒤 공백 문단   \n\n\n   둘째   ";
    const units = segmentText(raw, "문서");
    expect(units.map((u) => u.content)).toEqual(["앞뒤 공백 문단", "둘째"]);
    for (const unit of units) {
      expect(raw.slice(unit.citationStart, unit.citationEnd)).toBe(unit.content);
    }
  });

  it("truncates very long titles to 80 characters", () => {
    const longHeading = `# ${"가".repeat(120)}`;
    const raw = `${longHeading}\n\n본문.`;
    const [unit] = segmentText(raw, "문서");
    expect(unit?.title.length).toBeLessThanOrEqual(80);
    expect(unit?.title.endsWith("…")).toBe(true);
  });
});

describe("buildIngestionResult — validation", () => {
  const base = { userId: "u1", title: "제목", sourceType: "text" as const };

  it("rejects empty or whitespace-only rawText", () => {
    for (const rawText of ["", "   ", "\n\r\n\t"]) {
      expect(() => buildIngestionResult({ ...base, rawText })).toThrow(IngestionValidationError);
    }
  });

  it("rejects empty userId and title", () => {
    expect(() => buildIngestionResult({ ...base, userId: " ", rawText: "본문" })).toThrow(
      IngestionValidationError,
    );
    expect(() => buildIngestionResult({ ...base, title: "", rawText: "본문" })).toThrow(
      IngestionValidationError,
    );
  });

  it("rejects documents that would exceed the unit limit", () => {
    const raw = Array.from({ length: 501 }, (_, i) => `문단 ${i}`).join("\n\n");
    expect(() => buildIngestionResult({ ...base, rawText: raw })).toThrow(
      /exceeding the limit of 500/,
    );
  });

  it("trims the source title and carries request metadata", () => {
    const result = buildIngestionResult({
      ...base,
      title: "  자료구조  ",
      originalFilename: "notes.md",
      sourceType: "markdown",
      rawText: "스택은 LIFO이다.",
    });
    expect(result.source).toEqual({
      userId: "u1",
      title: "자료구조",
      sourceType: "markdown",
      originalFilename: "notes.md",
    });
    expect(result.rawText).toBe("스택은 LIFO이다.");
    expect(result.units).toHaveLength(1);
  });

  it("produces units without any database ids (no placeholder sourceId)", () => {
    const result = buildIngestionResult({ ...base, rawText: "본문." });
    for (const unit of result.units) {
      expect(unit).not.toHaveProperty("sourceId");
      expect(unit).not.toHaveProperty("id");
    }
  });
});
