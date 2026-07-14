import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type Fetcher, StudyUnitList } from "./StudyUnitList.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const sources = [{ id: "src-1", title: "운영체제 노트", sourceType: "text", unitCount: 2 }];
const units = [
  {
    id: "u1",
    title: "운영체제 노트 - Part 1",
    content: "프로세스는 실행 중인 프로그램이다.",
    orderIndex: 0,
    citationStart: 0,
    citationEnd: 19,
  },
  {
    id: "u2",
    title: "운영체제 노트 - Part 2",
    content: "스레드는 프로세스 내의 실행 단위이다.",
    orderIndex: 1,
    citationStart: 21,
    citationEnd: 42,
  },
];

describe("StudyUnitList (#9)", () => {
  it("renders units with citation badges after loading", async () => {
    const fetcher: Fetcher = async (url) =>
      url.includes("?userId=") ? jsonResponse({ sources }) : jsonResponse({ units });

    render(<StudyUnitList fetcher={fetcher} />);

    await waitFor(() => {
      expect(screen.getByLabelText("학습 유닛 목록")).toBeDefined();
    });
    expect(screen.getByText("운영체제 노트 - Part 1")).toBeDefined();
    expect(screen.getByText("근거 [0, 19)")).toBeDefined();
    expect(screen.getByText(/유닛 2개/)).toBeDefined();
  });

  it("shows the empty state when the user has no sources", async () => {
    const fetcher: Fetcher = async () => jsonResponse({ sources: [] });
    render(<StudyUnitList fetcher={fetcher} />);

    await waitFor(() => {
      expect(screen.getByText(/아직 업로드된 학습 자료가 없습니다/)).toBeDefined();
    });
  });

  it("shows an error state when the API is unavailable", async () => {
    const fetcher: Fetcher = async () => jsonResponse({ error: "db down" }, 503);
    render(<StudyUnitList fetcher={fetcher} />);

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("HTTP 503");
    });
  });
});
