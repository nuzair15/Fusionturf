-- Repair schema drift in derived statistics. These tables are recalculated
-- from fixtures/events, so keeping the newest duplicate is safe.
DELETE FROM "player_stats" AS older
USING "player_stats" AS newer
WHERE older."seasonId" = newer."seasonId"
  AND older."playerId" = newer."playerId"
  AND older."teamId" = newer."teamId"
  AND (older."updatedAt" < newer."updatedAt"
    OR (older."updatedAt" = newer."updatedAt" AND older."id"::text < newer."id"::text));

DELETE FROM "team_stats" AS older
USING "team_stats" AS newer
WHERE older."seasonId" = newer."seasonId"
  AND older."teamId" = newer."teamId"
  AND (older."updatedAt" < newer."updatedAt"
    OR (older."updatedAt" = newer."updatedAt" AND older."id"::text < newer."id"::text));

DROP INDEX IF EXISTS "player_stats_seasonId_playerId_key";
DROP INDEX IF EXISTS "player_stats_seasonId_playerId_teamId_key";
CREATE UNIQUE INDEX "player_stats_seasonId_playerId_teamId_key"
  ON "player_stats"("seasonId", "playerId", "teamId");

DROP INDEX IF EXISTS "team_stats_seasonId_teamId_key";
CREATE UNIQUE INDEX "team_stats_seasonId_teamId_key"
  ON "team_stats"("seasonId", "teamId");
