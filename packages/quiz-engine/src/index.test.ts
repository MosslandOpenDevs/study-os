import type { StudyUnit } from "@study-os/core";
import { describe, expect, it } from "vitest";
import { generateQuizDraft, gradeAnswer } from "./index.js";

const studyUnit: StudyUnit = {
  id: "unit-1",
  sourceId: "source-1",
  title: "이진 탐색",
  content: "이진 탐색은 정렬된 배열에서 중앙값과 비교하며 탐색 범위를 절반으로 줄인다.",
  orderIndex: 0,
};

describe("generateQuizDraft", () => {
  it("generates the requested number of drafts", () => {
    const drafts = generateQuizDraft({ studyUnit, quizType: "short-answer", count: 3 });
    expect(drafts).toHaveLength(3);
  });

  it("bases each prompt on the study unit title and content", () => {
    const [draft] = generateQuizDraft({ studyUnit, quizType: "short-answer", count: 1 });
    expect(draft?.prompt).toContain(studyUnit.title);
    expect(draft?.prompt).toContain("이진 탐색은 정렬된 배열에서");
  });

  it("returns no drafts when count is zero", () => {
    expect(generateQuizDraft({ studyUnit, quizType: "short-answer", count: 0 })).toEqual([]);
  });
});

describe("gradeAnswer", () => {
  it("accepts an exact match", () => {
    expect(gradeAnswer("스택", "스택")).toBe(true);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(gradeAnswer("LIFO", "  lifo ")).toBe(true);
  });

  it("rejects a non-matching answer", () => {
    expect(gradeAnswer("스택", "큐")).toBe(false);
  });

  it("rejects when the expected answer is empty", () => {
    expect(gradeAnswer("", "")).toBe(false);
    expect(gradeAnswer("   ", "무엇이든")).toBe(false);
  });

  // Known stub limitation, tracked by issue #3/#5 follow-ups: grading is exact
  // string equality with no Korean normalization, so semantically identical
  // answers are rejected. Pinned deliberately.
  it("still rejects semantically equal but differently-worded answers", () => {
    expect(gradeAnswer("스택", "스택입니다")).toBe(false);
  });
});
