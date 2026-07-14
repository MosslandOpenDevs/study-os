/**
 * Development seed data. Idempotent: every record is upserted by a fixed id,
 * so re-running `prisma db seed` never duplicates rows.
 */
import { createPrismaClient } from "@study-os/db";

const prisma = createPrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { id: "seed-user" },
    update: {},
    create: {
      id: "seed-user",
      displayName: "데모 학습자",
      locale: "ko-KR",
      timezone: "Asia/Seoul",
    },
  });

  await prisma.studyGoal.upsert({
    where: { id: "seed-goal" },
    update: {},
    create: {
      id: "seed-goal",
      userId: user.id,
      title: "정보처리기사 필기 (후보 vertical — 미확정)",
      goalType: "exam",
      status: "active",
    },
  });

  const source = await prisma.studySource.upsert({
    where: { id: "seed-source" },
    update: {},
    create: {
      id: "seed-source",
      userId: user.id,
      title: "운영체제 강의 노트",
      sourceType: "text",
    },
  });

  await prisma.studyUnit.upsert({
    where: { id: "seed-unit-1" },
    update: {},
    create: {
      id: "seed-unit-1",
      sourceId: source.id,
      title: "운영체제 강의 노트 - Part 1",
      content: "프로세스는 실행 중인 프로그램이다.",
      orderIndex: 0,
    },
  });

  await prisma.studyUnit.upsert({
    where: { id: "seed-unit-2" },
    update: {},
    create: {
      id: "seed-unit-2",
      sourceId: source.id,
      title: "운영체제 강의 노트 - Part 2",
      content: "스레드는 프로세스 내의 실행 단위이다.",
      orderIndex: 1,
    },
  });

  console.log("seed complete: 1 user, 1 goal, 1 source, 2 units");
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
