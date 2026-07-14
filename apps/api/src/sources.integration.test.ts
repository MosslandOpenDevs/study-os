import { createPrismaClient, type PrismaClient } from "@study-os/db";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

/**
 * Upload API contract (#7) + persistence (#8) against a real migrated
 * PostgreSQL database. Runs in CI (postgres service, migrations applied
 * before tests); skipped locally when DATABASE_URL is not set.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

const RAW_TEXT = `제1장 개요

프로세스는 실행 중인 프로그램이다.

스레드는 프로세스 내부의 실행 단위이다.`;

describe.skipIf(!hasDatabase)("source upload API (integration)", () => {
  let prisma: PrismaClient;
  let app: FastifyInstance;
  let userId: string;

  beforeAll(async () => {
    prisma = createPrismaClient();
    app = buildApp({ prisma });
    const user = await prisma.user.create({ data: { displayName: "upload-it-user" } });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } }); // cascades sources/units
    await app.close();
    await prisma.$disconnect();
  });

  it("readyz reports database connectivity", async () => {
    const res = await app.inject({ method: "GET", url: "/readyz" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ready", database: "ok" });
  });

  it("POST /api/sources ingests, persists, and returns real ids", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/sources",
      payload: {
        userId,
        title: "운영체제 노트",
        sourceType: "text",
        rawText: RAW_TEXT,
      },
    });
    expect(res.statusCode).toBe(201);

    const body = res.json();
    expect(body.sourceId).toBeTruthy();
    expect(body.unitCount).toBe(2);
    expect(body.unitIds).toHaveLength(2);
  });

  it("GET /api/sources lists the user's sources with unit counts", async () => {
    const res = await app.inject({ method: "GET", url: `/api/sources?userId=${userId}` });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.sources.length).toBeGreaterThanOrEqual(1);
    expect(body.sources[0]).toMatchObject({ title: "운영체제 노트", unitCount: 2 });
  });

  it("GET /api/sources/:id returns units in order with resolvable citations", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/sources",
      payload: { userId, title: "인용 검증", sourceType: "text", rawText: RAW_TEXT },
    });
    const { sourceId } = created.json();

    const res = await app.inject({ method: "GET", url: `/api/sources/${sourceId}` });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.units.map((u: { orderIndex: number }) => u.orderIndex)).toEqual([0, 1]);
    for (const unit of body.units) {
      // The citation invariant survives HTTP + database round-trips.
      expect(RAW_TEXT.slice(unit.citationStart, unit.citationEnd)).toBe(unit.content);
    }
  });

  it("returns 404 for an unknown user", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/sources",
      payload: { userId: "no-such-user", title: "t", sourceType: "text", rawText: "본문입니다." },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for invalid bodies (zod contract)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/sources",
      payload: { userId, title: "", sourceType: "pdf", rawText: "" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().issues.length).toBeGreaterThan(0);
  });

  it("returns 404 for a missing source id", async () => {
    const res = await app.inject({ method: "GET", url: "/api/sources/nonexistent-id" });
    expect(res.statusCode).toBe(404);
  });
});
