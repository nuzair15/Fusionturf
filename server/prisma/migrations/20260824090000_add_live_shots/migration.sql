CREATE TYPE "ShotOutcome" AS ENUM ('ON_TARGET', 'OFF_TARGET');

ALTER TYPE "MatchEventType" ADD VALUE 'SHOT';

CREATE TABLE "match_shots" (
    "id" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "outcome" "ShotOutcome" NOT NULL,
    "minute" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_shots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "match_shots_fixtureId_outcome_idx" ON "match_shots"("fixtureId", "outcome");
CREATE INDEX "match_shots_playerId_teamId_idx" ON "match_shots"("playerId", "teamId");

ALTER TABLE "match_shots" ADD CONSTRAINT "match_shots_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_shots" ADD CONSTRAINT "match_shots_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
