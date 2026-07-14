#!/usr/bin/env node
/**
 * Database smoke test: verifies that the built @study-os/db client connects
 * to the migrated database and that the seed data is present.
 *
 * Requires: DATABASE_URL set, migrations applied, seed executed, and
 * `pnpm build` completed (imports the built dist).
 */
import { createPrismaClient } from "../packages/db/dist/index.js";

function fail(message) {
  console.error(`DB SMOKE FAIL: ${message}`);
  process.exitCode = 1;
}

const prisma = createPrismaClient();

try {
  const userCount = await prisma.user.count();
  if (userCount < 1) {
    fail(`expected at least 1 seeded user, found ${userCount}`);
  } else {
    console.log(`db smoke: ${userCount} user(s) present`);
  }

  const source = await prisma.studySource.findUnique({
    where: { id: "seed-source" },
    include: { studyUnits: { orderBy: { orderIndex: "asc" } } },
  });
  if (!source) {
    fail("seeded StudySource 'seed-source' not found");
  } else if (source.studyUnits.length !== 2) {
    fail(`expected 2 seeded StudyUnits, found ${source.studyUnits.length}`);
  } else {
    console.log(`db smoke: source "${source.title}" has ${source.studyUnits.length} units`);
  }

  // Round-trip write: create and delete a throwaway goal to prove writes work.
  const goal = await prisma.studyGoal.create({
    data: {
      userId: "seed-user",
      title: "smoke-test goal",
      goalType: "custom",
    },
  });
  await prisma.studyGoal.delete({ where: { id: goal.id } });
  console.log("db smoke: write round-trip OK");

  if (process.exitCode !== 1) {
    console.log("DB SMOKE PASS");
  }
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
} finally {
  await prisma.$disconnect();
}
