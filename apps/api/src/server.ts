import { buildApp } from "./app.js";

const app = buildApp({ logger: true });

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const host = process.env.HOST ?? "127.0.0.1";

if (Number.isNaN(port) || port < 0 || port > 65535) {
  app.log.error({ port: process.env.PORT }, "invalid PORT");
  process.exit(1);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, "received shutdown signal");
    app.close().then(
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
