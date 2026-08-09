CREATE TABLE "friendly_player_stats" (
  "id" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "appearances" INTEGER NOT NULL DEFAULT 0,
  "goals" INTEGER NOT NULL DEFAULT 0,
  "assists" INTEGER NOT NULL DEFAULT 0,
  "minutesPlayed" INTEGER NOT NULL DEFAULT 0,
  "shots" INTEGER NOT NULL DEFAULT 0,
  "shotsOnTarget" INTEGER NOT NULL DEFAULT 0,
  "yellowCards" INTEGER NOT NULL DEFAULT 0,
  "redCards" INTEGER NOT NULL DEFAULT 0,
  "averageRating" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "friendly_player_stats_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "friendly_player_stats_seasonId_playerId_teamId_key" ON "friendly_player_stats"("seasonId", "playerId", "teamId");
ALTER TABLE "friendly_player_stats" ADD CONSTRAINT "friendly_player_stats_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "friendly_player_stats" ADD CONSTRAINT "friendly_player_stats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "friendly_player_stats" ADD CONSTRAINT "friendly_player_stats_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
