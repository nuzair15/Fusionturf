CREATE TABLE "player_transfers" (
  "id" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "fromTeamId" TEXT,
  "toTeamId" TEXT,
  "fromSeasonId" TEXT,
  "toSeasonId" TEXT,
  "reason" TEXT,
  "createdById" TEXT,
  "transferredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "player_transfers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "player_transfers_playerId_transferredAt_idx" ON "player_transfers"("playerId", "transferredAt");
ALTER TABLE "player_transfers" ADD CONSTRAINT "player_transfers_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "player_transfers" ADD CONSTRAINT "player_transfers_fromTeamId_fkey" FOREIGN KEY ("fromTeamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "player_transfers" ADD CONSTRAINT "player_transfers_toTeamId_fkey" FOREIGN KEY ("toTeamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "player_transfers" ADD CONSTRAINT "player_transfers_fromSeasonId_fkey" FOREIGN KEY ("fromSeasonId") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "player_transfers" ADD CONSTRAINT "player_transfers_toSeasonId_fkey" FOREIGN KEY ("toSeasonId") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "player_transfers" ADD CONSTRAINT "player_transfers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "match_result_revisions" (
  "id" TEXT NOT NULL,
  "fixtureId" TEXT NOT NULL,
  "changedById" TEXT,
  "previousHomeScore" INTEGER,
  "previousAwayScore" INTEGER,
  "nextHomeScore" INTEGER NOT NULL,
  "nextAwayScore" INTEGER NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "match_result_revisions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "match_result_revisions_fixtureId_createdAt_idx" ON "match_result_revisions"("fixtureId", "createdAt");
ALTER TABLE "match_result_revisions" ADD CONSTRAINT "match_result_revisions_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_result_revisions" ADD CONSTRAINT "match_result_revisions_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
