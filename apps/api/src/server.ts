import { createPrismaClient, type PrismaClient } from "@study-os/db";
import { buildApp } from "./app.js";

// Database is optional at boot: without DATABASE_URL the API still serves its
// database-less routes and returns 503 from the database-backed ones.
let prisma: PrismaClient | undefined;
if (process.env.DATABASE_URL) {
  prisma = createPrismaClient();
}

const app = buildApp({ logger: true, prisma });

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const host = process.env.HOST ?? "127.0.0.1";

if (Number.isNaN(port) || port < 0 || port > 65535) {
  app.log.error({ port: process.env.PORT }, "invalid PORT");
  process.exit(1);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, "received shutdown signal");
    app
      .close()
      .then(() => prisma?.$disconnect())
      .then(
        () => {
          app.log.info("shutdown complete");
          process.exit(0);
        },
        (err: unknown) => {
          app.log.error(err, "error during shutdown");
          process.exit(1);
        },
      );
  });
}

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err, "failed to start server");
  process.exit(1);
}
