import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "./index.js";

describe("createPrismaClient", () => {
  let savedUrl: string | undefined;

  beforeEach(() => {
    savedUrl = process.env.DATABASE_URL;
  });

  afterEach(() => {
    if (savedUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = savedUrl;
    }
  });

  it("throws a clear error when DATABASE_URL is missing", () => {
    delete process.env.DATABASE_URL;
    expect(() => createPrismaClient()).toThrow(/DATABASE_URL is not set/);
  });

  it("constructs a client when a connection string is provided (no connection attempted)", async () => {
    const client = createPrismaClient({
      connectionString: "postgresql://user:pass@localhost:5432/db",
    });
    expect(client).toBeDefined();
    await client.$disconnect();
  });
});
