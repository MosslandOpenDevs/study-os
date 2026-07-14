import { describe, expect, it } from "vitest";
import { buildIngestionResult, splitIntoStudyUnits } from "./index.js";

describe("splitIntoStudyUnits", () => {
  it("splits paragraphs separated by blank lines into ordered chunks", () => {
    const chunks = splitIntoStudyUnits({
      userId: "u1",
      title: "운영체제 3장",
      sourceType: "text",
      rawText: "프로세스는 실행 중인 프로그램이다.\n\n스레드는 프로세스 내 실행 단위이다.",
    });

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({
      title: "운영체제 3장 - Part 1",
      content: "프로세스는 실행 중인 프로그램이다.",
      orderIndex: 0,
    });
    expect(chunks[1]).toMatchObject({
      title: "운영체제 3장 - Part 2",
      content: "스레드는 프로세스 내 실행 단위이다.",
      orderIndex: 1,
    });
  });

  it("trims surrounding whitespace and drops empty segments", () => {
    const chunks = splitIntoStudyUnits({
      userId: "u1",
      title: "t",
      sourceType: "text",
      rawText: "  첫 문단  \n\n\n\n  둘째 문단  \n\n",
    });

    expect(chunks.map((c) => c.content)).toEqual(["첫 문단", "둘째 문단"]);
  });

  it("returns no chunks for empty or whitespace-only input", () => {
    for (const rawText of ["", "   ", "\n\n\n"]) {
      expect(
        splitIntoStudyUnits({ userId: "u1", title: "t", sourceType: "text", rawText }),
      ).toEqual([]);
    }
  });
});

describe("buildIngestionResult", () => {
  it("maps the request onto a source and its units", () => {
    const result = buildIngestionResult({
      userId: "u1",
      title: "자료구조",
      sourceType: "markdown",
      originalFilename: "notes.md",
      rawText: "스택은 LIFO이다.\n\n큐는 FIFO이다.",
    });

    expect(result.source).toEqual({
      userId: "u1",
      title: "자료구조",
      sourceType: "markdown",
      originalFilename: "notes.md",
      storageUrl: undefined,
    });
    expect(result.units).toHaveLength(2);
    expect(result.units.map((u) => u.orderIndex)).toEqual([0, 1]);
  });

  // Known stub limitation, tracked by issue #3: sourceId is a placeholder and
  // citation offsets are never populated. These tests pin the current
  // behavior so the #3 rework is forced to update them deliberately.
  it("still uses the pending-source-id placeholder (issue #3)", () => {
    const result = buildIngestionResult({
      userId: "u1",
      title: "t",
      sourceType: "text",
      rawText: "본문",
    });

    expect(result.units[0]?.sourceId).toBe("pending-source-id");
    expect(result.units[0]?.citationStart).toBeUndefined();
    expect(result.units[0]?.citationEnd).toBeUndefined();
  });
});
