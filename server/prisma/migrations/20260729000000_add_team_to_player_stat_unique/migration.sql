-- Drop old unique constraint (seasonId + playerId)
DROP INDEX IF EXISTS "player_stats_seasonId_playerId_key";

-- Add new unique constraint (seasonId + playerId + teamId)
CREATE UNIQUE INDEX IF NOT EXISTS "player_stats_seasonId_playerId_teamId_key" ON "player_stats"("seasonId", "playerId", "teamId");

-- Make sure the migration tracker knows this was applied
-- Used with: npx prisma migrate resolve --applied 20260729000000_add_team_to_player_stat_unique
