import "dotenv/config";
import { defineConfig } from "prisma/config";

// Falls back to the docker-compose.yml development database so that commands
// that never touch the database (e.g. `prisma generate`) work without a .env.
// CI and real environments must set DATABASE_URL explicitly.
const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://studyos:studyos@localhost:5432/studyos";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl,
  },
});
