-- CreateEnum
CREATE TYPE "SquadType" AS ENUM ('STARTER', 'SUBSTITUTE', 'RESERVE');

-- CreateEnum
CREATE TYPE "SuspensionReason" AS ENUM ('YELLOW_ACCUMULATION', 'STRAIGHT_RED', 'SECOND_YELLOW', 'VIOLENT_CONDUCT', 'SERIOUS_MISCONDUCT');

-- AlterTable: add league system columns to seasons
ALTER TABLE "seasons" ADD COLUMN "leagueWeeks" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "seasons" ADD COLUMN "fixtureDays" TEXT NOT NULL DEFAULT 'Friday,Saturday,Sunday';
ALTER TABLE "seasons" ADD COLUMN "transferWindowOpen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "seasons" ADD COLUMN "transferWindowStartsAt" TIMESTAMP(3);
ALTER TABLE "seasons" ADD COLUMN "transferWindowEndsAt" TIMESTAMP(3);

-- AlterTable: add squadType to players
ALTER TABLE "players" ADD COLUMN "squadType" "SquadType";

-- AlterTable: add league system columns to fixtures
ALTER TABLE "fixtures" ADD COLUMN "leagueWeek" INTEGER;
ALTER TABLE "fixtures" ADD COLUMN "isGrandFinal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "fixtures" ADD COLUMN "isRelegationPlayoff" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: matchday_squads
CREATE TABLE "matchday_squads" (
    "id" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "matchday_squads_pkey" PRIMARY KEY ("id")
);

-- CreateTable: matchday_squad_entries
CREATE TABLE "matchday_squad_entries" (
    "id" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "isStarter" BOOLEAN NOT NULL DEFAULT true,
    "jerseyNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "matchday_squad_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable: suspensions
CREATE TABLE "suspensions" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "reason" "SuspensionReason" NOT NULL,
    "matchBan" INTEGER NOT NULL DEFAULT 1,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "served" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "suspensions_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX "matchday_squads_fixtureId_teamId_key" ON "matchday_squads"("fixtureId", "teamId");
CREATE UNIQUE INDEX "matchday_squad_entries_squadId_playerId_key" ON "matchday_squad_entries"("squadId", "playerId");
CREATE INDEX "suspensions_seasonId_playerId_idx" ON "suspensions"("seasonId", "playerId");

-- AddForeignKeys
ALTER TABLE "matchday_squads" ADD CONSTRAINT "matchday_squads_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "matchday_squads" ADD CONSTRAINT "matchday_squads_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "matchday_squad_entries" ADD CONSTRAINT "matchday_squad_entries_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "matchday_squads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "matchday_squad_entries" ADD CONSTRAINT "matchday_squad_entries_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "suspensions" ADD CONSTRAINT "suspensions_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "suspensions" ADD CONSTRAINT "suspensions_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
