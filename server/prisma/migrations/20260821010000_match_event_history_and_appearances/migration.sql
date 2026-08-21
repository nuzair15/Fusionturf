-- Add nullable snapshots first so this is safe for existing production data.
ALTER TABLE "goals" ADD COLUMN "teamId" TEXT;
ALTER TABLE "assists" ADD COLUMN "teamId" TEXT;
ALTER TABLE "cards" ADD COLUMN "teamId" TEXT;
ALTER TABLE "substitutions" ADD COLUMN "teamId" TEXT;

-- Backfill from the player's current club. This is the best available legacy
-- value; new writes use the event-time snapshot and are transfer-safe.
UPDATE "goals" g SET "teamId" = p."teamId" FROM "players" p WHERE p.id = g."playerId";
UPDATE "assists" a SET "teamId" = p."teamId" FROM "players" p WHERE p.id = a."playerId";
UPDATE "cards" c SET "teamId" = p."teamId" FROM "players" p WHERE p.id = c."playerId";

CREATE INDEX "goals_fixtureId_teamId_idx" ON "goals"("fixtureId", "teamId");
CREATE INDEX "assists_fixtureId_teamId_idx" ON "assists"("fixtureId", "teamId");
CREATE INDEX "cards_fixtureId_teamId_idx" ON "cards"("fixtureId", "teamId");
CREATE INDEX "substitutions_fixtureId_teamId_idx" ON "substitutions"("fixtureId", "teamId");
CREATE UNIQUE INDEX "lineups_fixtureId_playerId_key" ON "lineups"("fixtureId", "playerId");

CREATE TABLE "match_appearances" (
  "id" TEXT NOT NULL,
  "fixtureId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "isStarter" BOOLEAN NOT NULL DEFAULT false,
  "enteredAt" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "match_appearances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "match_appearances_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("id") ON DELETE CASCADE,
  CONSTRAINT "match_appearances_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "match_appearances_fixtureId_playerId_key" ON "match_appearances"("fixtureId", "playerId");
CREATE INDEX "match_appearances_playerId_teamId_idx" ON "match_appearances"("playerId", "teamId");

-- Existing lineup rows are legitimate appearances under the agreed rule.
INSERT INTO "match_appearances" ("id", "fixtureId", "playerId", "teamId", "isStarter", "createdAt")
SELECT md5(l.id), l."fixtureId", l."playerId", l."teamId", l."isStarter", l."createdAt" FROM "lineups" l
ON CONFLICT ("fixtureId", "playerId") DO NOTHING;
