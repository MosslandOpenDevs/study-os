/**
 * Development seed data. Idempotent: every record is upserted by a fixed id,
 * so re-running `prisma db seed` never duplicates rows.
 */
import { createHash } from "node:crypto";
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

  const seedRawText = "프로세스는 실행 중인 프로그램이다.\n\n스레드는 프로세스 내의 실행 단위이다.";
  const revision = await prisma.sourceRevision.upsert({
    where: { id: "seed-revision-1" },
    update: {},
    create: {
      id: "seed-revision-1",
      sourceId: source.id,
      revision: 1,
      rawText: seedRawText,
      contentSha256: createHash("sha256").update(seedRawText, "utf8").digest("hex"),
      contentLength: seedRawText.length,
    },
  });

  const unit1Content = "프로세스는 실행 중인 프로그램이다.";
  const unit2Content = "스레드는 프로세스 내의 실행 단위이다.";

  await prisma.studyUnit.upsert({
    where: { id: "seed-unit-1" },
    update: {},
    create: {
      id: "seed-unit-1",
      sourceId: source.id,
      sourceRevisionId: revision.id,
      title: "운영체제 강의 노트 - Part 1",
      content: unit1Content,
      orderIndex: 0,
      citationStart: seedRawText.indexOf(unit1Content),
      citationEnd: seedRawText.indexOf(unit1Content) + unit1Content.length,
    },
  });

  await prisma.studyUnit.upsert({
    where: { id: "seed-unit-2" },
    update: {},
    create: {
      id: "seed-unit-2",
      sourceId: source.id,
      sourceRevisionId: revision.id,
      title: "운영체제 강의 노트 - Part 2",
      content: unit2Content,
      orderIndex: 1,
      citationStart: seedRawText.indexOf(unit2Content),
      citationEnd: seedRawText.indexOf(unit2Content) + unit2Content.length,
    },
  });

  console.log("seed complete: 1 user, 1 goal, 1 source, 2 units");
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
