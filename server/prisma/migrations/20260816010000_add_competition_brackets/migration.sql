ALTER TABLE "competitions" ADD COLUMN "bracketSize" INTEGER;
ALTER TABLE "competitions" ADD COLUMN "bracketStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED';

CREATE TABLE "bracket_matches" (
  "id" TEXT NOT NULL,
  "competitionId" TEXT NOT NULL,
  "roundNumber" INTEGER NOT NULL,
  "position" INTEGER NOT NULL,
  "fixtureId" TEXT,
  "homeTeamId" TEXT,
  "awayTeamId" TEXT,
  "winnerTeamId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bracket_matches_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "bracket_matches_fixtureId_key" ON "bracket_matches"("fixtureId");
CREATE UNIQUE INDEX "bracket_matches_competitionId_roundNumber_position_key" ON "bracket_matches"("competitionId", "roundNumber", "position");
CREATE INDEX "bracket_matches_competitionId_roundNumber_idx" ON "bracket_matches"("competitionId", "roundNumber");
ALTER TABLE "bracket_matches" ADD CONSTRAINT "bracket_matches_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bracket_matches" ADD CONSTRAINT "bracket_matches_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bracket_matches" ADD CONSTRAINT "bracket_matches_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bracket_matches" ADD CONSTRAINT "bracket_matches_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bracket_matches" ADD CONSTRAINT "bracket_matches_winnerTeamId_fkey" FOREIGN KEY ("winnerTeamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
