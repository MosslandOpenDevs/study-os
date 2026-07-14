import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

export * from "./ingestion.js";
export { PrismaClient };

export interface CreatePrismaClientOptions {
  /** Overrides DATABASE_URL from the environment. */
  connectionString?: string;
}

/**
 * Creates a PrismaClient backed by the PostgreSQL driver adapter (Prisma 7
 * has no Rust query engine; the adapter is mandatory).
 */
export function createPrismaClient(options: CreatePrismaClientOptions = {}): PrismaClient {
  const connectionString = options.connectionString ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env (and start the database with `docker compose up -d`).",
    );
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}
