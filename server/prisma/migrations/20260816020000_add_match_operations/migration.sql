ALTER TABLE "fixtures" ADD COLUMN "refereeAssignedAt" TIMESTAMP(3);
ALTER TABLE "fixtures" ADD COLUMN "originalMatchDate" TIMESTAMP(3);
ALTER TABLE "fixtures" ADD COLUMN "postponementReason" TEXT;
ALTER TABLE "fixtures" ADD COLUMN "rescheduleReason" TEXT;
ALTER TABLE "fixtures" ADD COLUMN "rescheduledAt" TIMESTAMP(3);
ALTER TABLE "fixtures" ADD COLUMN "extraTimeHomeScore" INTEGER;
ALTER TABLE "fixtures" ADD COLUMN "extraTimeAwayScore" INTEGER;
ALTER TABLE "fixtures" ADD COLUMN "penaltiesHomeScore" INTEGER;
ALTER TABLE "fixtures" ADD COLUMN "penaltiesAwayScore" INTEGER;
ALTER TABLE "fixtures" ADD COLUMN "winnerTeamId" TEXT;
ALTER TABLE "fixtures" ADD COLUMN "outcome" TEXT NOT NULL DEFAULT 'REGULAR';

CREATE TABLE "standing_adjustments" (
  "id" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "pointsDelta" INTEGER NOT NULL DEFAULT 0,
  "goalsForDelta" INTEGER NOT NULL DEFAULT 0,
  "goalsAgainstDelta" INTEGER NOT NULL DEFAULT 0,
  "reason" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "standing_adjustments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "standing_adjustments_seasonId_teamId_idx" ON "standing_adjustments"("seasonId", "teamId");
ALTER TABLE "standing_adjustments" ADD CONSTRAINT "standing_adjustments_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "standing_adjustments" ADD CONSTRAINT "standing_adjustments_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
