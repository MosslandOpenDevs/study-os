import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockSummaryCard } from "./mockSummaryCard.js";
import { SummaryCardView } from "./SummaryCardView.js";

describe("SummaryCardView (#11, mock data)", () => {
  it("renders summary, key concepts, confusion points, and tone badge", () => {
    render(<SummaryCardView card={mockSummaryCard} />);

    expect(screen.getByText(/프로세스는 실행 중인 프로그램/)).toBeDefined();
    expect(screen.getByText("교사 모드")).toBeDefined();

    const concepts = screen.getByLabelText("핵심 개념 목록");
    expect(concepts.querySelectorAll("li")).toHaveLength(3);
    expect(screen.getByText("프로세스")).toBeDefined();

    expect(screen.getByText(/프로세스 간 통신과 스레드 간 공유 메모리/)).toBeDefined();
  });

  it("labels the card as AI-generated with provenance", () => {
    render(<SummaryCardView card={mockSummaryCard} />);
    expect(screen.getByText(/AI 생성 · mock\/mock-deterministic-v1/)).toBeDefined();
  });

  it("omits the confusion section when there are no points", () => {
    render(<SummaryCardView card={{ ...mockSummaryCard, confusionPoints: [] }} />);
    expect(screen.queryByLabelText("혼동 포인트 목록")).toBeNull();
  });
});
