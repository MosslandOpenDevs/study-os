import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

const app = buildApp();

afterAll(async () => {
  await app.close();
});

describe("health endpoints", () => {
  it("GET /healthz returns ok", async () => {
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("GET /readyz returns ready", async () => {
    const res = await app.inject({ method: "GET", url: "/readyz" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ready" });
  });

  it("GET / returns service identity", async () => {
    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ name: "study-os-api" });
  });
});

describe("demo study-loop pipeline", () => {
  it("exercises ingestion, quiz-engine, and scheduler at runtime", async () => {
    const res = await app.inject({ method: "GET", url: "/api/demo/study-loop" });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.ingestion.units).toHaveLength(2);
    expect(body.quizDraft).toHaveLength(2);
    expect(body.reviewTask.status).toBe("pending");
    expect(new Date(body.reviewTask.scheduledAt).getTime()).toBeGreaterThan(Date.now());
  });
});

describe("POST /api/demo/summary", () => {
  const validBody = {
    title: "프로세스와 스레드",
    content:
      "프로세스는 실행 중인 프로그램이다. 스레드는 프로세스 내부의 실행 단위이며 같은 주소 공간을 공유한다.",
  };

  it("returns a Korean summary card via the default (mock) provider", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/demo/summary",
      payload: validBody,
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.provider).toBe("mock");
    expect(body.card.shortSummary).toContain("프로세스는 실행 중인 프로그램이다");
    expect(body.card.keyConcepts.length).toBeGreaterThan(0);
    expect(body.card.generation.inputSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects missing fields with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/demo/summary",
      payload: { title: "제목만" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects an unknown tone preset with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/demo/summary",
      payload: { ...validBody, tonePreset: "poet" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("fails closed (400) when content cannot ground a summary", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/demo/summary",
      payload: { title: "t", content: "짧다" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/too short/);
  });
});
