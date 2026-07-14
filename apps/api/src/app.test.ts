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
