ALTER TABLE "suspensions"
  ADD COLUMN "competitionId" TEXT,
  ADD COLUMN "milestone" INTEGER,
  ADD COLUMN "servedFixtureIds" JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "suspensions"
  ADD CONSTRAINT "suspensions_competitionId_fkey"
  FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "suspensions_competitionId_playerId_isActive_idx"
  ON "suspensions"("competitionId", "playerId", "isActive");

-- A completed milestone remains reserved after its ban is served. This makes
-- projection retries and later fixtures unable to recreate the same ban.
CREATE UNIQUE INDEX "suspensions_yellow_milestone_unique"
  ON "suspensions"("seasonId", "playerId", COALESCE("competitionId", ''), "reason", "milestone")
  WHERE "reason" = 'YELLOW_ACCUMULATION' AND "milestone" IS NOT NULL;
