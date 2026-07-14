import type { SummaryCardData } from "./SummaryCardView.js";

/**
 * Mock data for the summary card UI (issue #11 explicitly calls for
 * mock-generated data). Mirrors the shape @study-os/summary produces.
 */
export const mockSummaryCard: SummaryCardData = {
  shortSummary:
    "핵심을 차근차근 정리하면, 프로세스는 실행 중인 프로그램이며 운영체제 자원 배분의 기본 단위다. 스레드는 프로세스 내부의 실행 흐름으로 같은 주소 공간을 공유한다.",
  keyConcepts: ["프로세스", "스레드", "주소 공간"],
  confusionPoints: ["프로세스 간 통신과 스레드 간 공유 메모리의 차이"],
  tonePreset: "teacher",
  generation: {
    provider: "mock",
    model: "mock-deterministic-v1",
    promptVersion: "ko-summary-mock-v1",
  },
};
