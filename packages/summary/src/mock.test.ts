import { describe, expect, it } from "vitest";
import { MockSummaryProvider } from "./mock.js";
import { SummaryValidationError } from "./types.js";

const provider = new MockSummaryProvider();

const request = {
  unit: {
    title: "프로세스와 스레드",
    content:
      "프로세스는 실행 중인 프로그램이다. 스레드는 프로세스 내부의 실행 단위이며 같은 주소 공간을 공유한다.",
  },
} as const;

describe("MockSummaryProvider", () => {
  it("generates a Korean summary card grounded in the content", async () => {
    const card = await provider.generateSummary(request);

    expect(card.shortSummary).toContain("프로세스는 실행 중인 프로그램이다");
    expect(card.keyConcepts.length).toBeGreaterThan(0);
    expect(card.keyConcepts.length).toBeLessThanOrEqual(10);
    expect(card.tonePreset).toBe("teacher");
    expect(card.generation.provider).toBe("mock");
    expect(card.generation.inputSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic: identical input yields identical output", async () => {
    const a = await provider.generateSummary(request);
    const b = await provider.generateSummary(request);
    expect(a).toEqual(b);
  });

  it("applies the tone preset", async () => {
    const exam = await provider.generateSummary({ ...request, tonePreset: "concise-exam" });
    expect(exam.shortSummary.startsWith("시험 대비 요점:")).toBe(true);
    expect(exam.tonePreset).toBe("concise-exam");
  });

  it("fails closed on empty content", async () => {
    await expect(
      provider.generateSummary({ unit: { title: "t", content: "   " } }),
    ).rejects.toThrow(SummaryValidationError);
  });

  it("fails closed on content too short to ground a summary", async () => {
    await expect(
      provider.generateSummary({ unit: { title: "t", content: "짧다" } }),
    ).rejects.toThrow(/too short/);
  });
});
