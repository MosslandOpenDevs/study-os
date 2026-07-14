-- CreateEnum
CREATE TYPE "ErrorCause" AS ENUM ('concept_gap', 'condition_misread', 'procedure_slip', 'time_pressure', 'faulty_item');

-- CreateEnum
CREATE TYPE "ErrorEpisodeStatus" AS ENUM ('open', 'cause_confirmed', 'intervened', 'resolved', 'item_faulty');

-- CreateEnum
CREATE TYPE "InterventionKind" AS ENUM ('reexplanation', 'prerequisite_check', 'condition_drill', 'checklist', 'discrimination_set', 'timed_set', 'item_regenerated');

-- CreateEnum
CREATE TYPE "TransferResult" AS ENUM ('pending', 'passed', 'failed');

-- CreateEnum
CREATE TYPE "ReviewRating" AS ENUM ('again', 'hard', 'good', 'easy');

-- CreateEnum
CREATE TYPE "GenerationKind" AS ENUM ('summary', 'quiz', 'cause_suggestion', 'intervention', 'transfer_item');

-- CreateEnum
CREATE TYPE "GradingMethod" AS ENUM ('exact_match', 'normalized_match', 'model_graded', 'manual');

-- DropForeignKey
ALTER TABLE "ErrorNotebookEntry" DROP CONSTRAINT "ErrorNotebookEntry_userId_fkey";

-- DropForeignKey
ALTER TABLE "ErrorNotebookEntry" DROP CONSTRAINT "ErrorNotebookEntry_quizItemId_fkey";

-- DropForeignKey
ALTER TABLE "ErrorNotebookEntry" DROP CONSTRAINT "ErrorNotebookEntry_attemptId_fkey";

-- DropForeignKey
ALTER TABLE "ReviewTask" DROP CONSTRAINT "ReviewTask_userId_fkey";

-- DropForeignKey
ALTER TABLE "ReviewTask" DROP CONSTRAINT "ReviewTask_notebookEntryId_fkey";

-- AlterTable
ALTER TABLE "StudyUnit" ADD COLUMN     "sourceRevisionId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "SummaryCard" ADD COLUMN     "generationRunId" TEXT;

-- AlterTable
ALTER TABLE "QuizItem" ADD COLUMN     "acceptedAnswers" TEXT[],
ADD COLUMN     "generationRunId" TEXT,
ADD COLUMN     "rubric" TEXT;

-- AlterTable
ALTER TABLE "Attempt" ADD COLUMN     "confidence" INTEGER,
ADD COLUMN     "gradingMethod" "GradingMethod" NOT NULL DEFAULT 'exact_match',
ADD COLUMN     "latencyMs" INTEGER;

-- DropTable
DROP TABLE "ErrorNotebookEntry";

-- DropTable
DROP TABLE "ReviewTask";

-- DropEnum
DROP TYPE "ErrorType";

-- DropEnum
DROP TYPE "ReviewStatus";

-- CreateTable
CREATE TABLE "SourceRevision" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "rawText" TEXT NOT NULL,
    "contentSha256" TEXT NOT NULL,
    "contentLength" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceSpan" (
    "id" TEXT NOT NULL,
    "sourceRevisionId" TEXT NOT NULL,
    "start" INTEGER NOT NULL,
    "end" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceSpan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationRun" (
    "id" TEXT NOT NULL,
    "kind" "GenerationKind" NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "inputSha256" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "costUsd" DECIMAL(10,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizChoice" (
    "id" TEXT NOT NULL,
    "quizItemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "orderIndex" INTEGER NOT NULL,

    CONSTRAINT "QuizChoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizItemCitation" (
    "id" TEXT NOT NULL,
    "quizItemId" TEXT NOT NULL,
    "sourceSpanId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuizItemCitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErrorEpisode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quizItemId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "status" "ErrorEpisodeStatus" NOT NULL DEFAULT 'open',
    "suggestedCause" "ErrorCause",
    "suggestedByRunId" TEXT,
    "confirmedCause" "ErrorCause",
    "confirmedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErrorEpisode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Intervention" (
    "id" TEXT NOT NULL,
    "errorEpisodeId" TEXT NOT NULL,
    "kind" "InterventionKind" NOT NULL,
    "content" TEXT,
    "generationRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Intervention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferAttempt" (
    "id" TEXT NOT NULL,
    "errorEpisodeId" TEXT NOT NULL,
    "quizItemId" TEXT NOT NULL,
    "attemptId" TEXT,
    "result" "TransferResult" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "errorEpisodeId" TEXT,
    "rating" "ReviewRating" NOT NULL,
    "latencyMs" INTEGER,
    "algorithm" TEXT NOT NULL,
    "schedulerStateBefore" JSONB,
    "schedulerStateAfter" JSONB,
    "scheduledAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SourceRevision_sourceId_revision_key" ON "SourceRevision"("sourceId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "QuizItemCitation_quizItemId_sourceSpanId_key" ON "QuizItemCitation"("quizItemId", "sourceSpanId");

-- CreateIndex
CREATE UNIQUE INDEX "ErrorEpisode_attemptId_key" ON "ErrorEpisode"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "TransferAttempt_attemptId_key" ON "TransferAttempt"("attemptId");

-- AddForeignKey
ALTER TABLE "SourceRevision" ADD CONSTRAINT "SourceRevision_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "StudySource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceSpan" ADD CONSTRAINT "SourceSpan_sourceRevisionId_fkey" FOREIGN KEY ("sourceRevisionId") REFERENCES "SourceRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyUnit" ADD CONSTRAINT "StudyUnit_sourceRevisionId_fkey" FOREIGN KEY ("sourceRevisionId") REFERENCES "SourceRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SummaryCard" ADD CONSTRAINT "SummaryCard_generationRunId_fkey" FOREIGN KEY ("generationRunId") REFERENCES "GenerationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizItem" ADD CONSTRAINT "QuizItem_generationRunId_fkey" FOREIGN KEY ("generationRunId") REFERENCES "GenerationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizChoice" ADD CONSTRAINT "QuizChoice_quizItemId_fkey" FOREIGN KEY ("quizItemId") REFERENCES "QuizItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizItemCitation" ADD CONSTRAINT "QuizItemCitation_quizItemId_fkey" FOREIGN KEY ("quizItemId") REFERENCES "QuizItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizItemCitation" ADD CONSTRAINT "QuizItemCitation_sourceSpanId_fkey" FOREIGN KEY ("sourceSpanId") REFERENCES "SourceSpan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErrorEpisode" ADD CONSTRAINT "ErrorEpisode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErrorEpisode" ADD CONSTRAINT "ErrorEpisode_quizItemId_fkey" FOREIGN KEY ("quizItemId") REFERENCES "QuizItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErrorEpisode" ADD CONSTRAINT "ErrorEpisode_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErrorEpisode" ADD CONSTRAINT "ErrorEpisode_suggestedByRunId_fkey" FOREIGN KEY ("suggestedByRunId") REFERENCES "GenerationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_errorEpisodeId_fkey" FOREIGN KEY ("errorEpisodeId") REFERENCES "ErrorEpisode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_generationRunId_fkey" FOREIGN KEY ("generationRunId") REFERENCES "GenerationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferAttempt" ADD CONSTRAINT "TransferAttempt_errorEpisodeId_fkey" FOREIGN KEY ("errorEpisodeId") REFERENCES "ErrorEpisode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferAttempt" ADD CONSTRAINT "TransferAttempt_quizItemId_fkey" FOREIGN KEY ("quizItemId") REFERENCES "QuizItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferAttempt" ADD CONSTRAINT "TransferAttempt_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewEvent" ADD CONSTRAINT "ReviewEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewEvent" ADD CONSTRAINT "ReviewEvent_errorEpisodeId_fkey" FOREIGN KEY ("errorEpisodeId") REFERENCES "ErrorEpisode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

