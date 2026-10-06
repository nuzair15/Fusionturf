-- CreateTable
CREATE TABLE "tournaments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Riyadh',
    "lineupSize" INTEGER NOT NULL DEFAULT 6,
    "halfLengthMinutes" INTEGER NOT NULL DEFAULT 30,
    "halftimeBreakMinutes" INTEGER NOT NULL DEFAULT 10,
    "matchesPerPair" INTEGER NOT NULL DEFAULT 1,
    "groupCount" INTEGER,
    "qualifiersPerGroup" INTEGER,
    "kickoffTime" TEXT,
    "matchIntervalMinutes" INTEGER NOT NULL DEFAULT 90,
    "matchesPerDay" INTEGER NOT NULL DEFAULT 2,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_teams" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "logoUrl" TEXT,
    "city" TEXT,
    "coach" TEXT,
    "contact" TEXT,
    "description" TEXT,
    "groupName" TEXT,
    "seed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournament_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_players" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "jerseyNumber" INTEGER,
    "position" TEXT,
    "photoUrl" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "nationality" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournament_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_fixtures" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "winnerTeamId" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'LEAGUE',
    "groupName" TEXT,
    "round" INTEGER NOT NULL DEFAULT 1,
    "slot" INTEGER NOT NULL DEFAULT 1,
    "kickoffAt" TIMESTAMP(3) NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "homeScore" INTEGER NOT NULL DEFAULT 0,
    "awayScore" INTEGER NOT NULL DEFAULT 0,
    "penaltiesHomeScore" INTEGER,
    "penaltiesAwayScore" INTEGER,
    "matchClockSeconds" INTEGER NOT NULL DEFAULT 0,
    "matchClockStartedAt" TIMESTAMP(3),
    "teamStats" JSONB,
    "manOfTheMatchId" TEXT,
    "playerRatings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournament_fixtures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_lineups" (
    "id" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "isStarter" BOOLEAN NOT NULL DEFAULT true,
    "isCaptain" BOOLEAN NOT NULL DEFAULT false,
    "isGoalkeeper" BOOLEAN NOT NULL DEFAULT false,
    "position" TEXT,

    CONSTRAINT "tournament_lineups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_events" (
    "id" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "teamId" TEXT,
    "playerId" TEXT,
    "relatedPlayerId" TEXT,
    "kind" TEXT NOT NULL,
    "minute" INTEGER NOT NULL,
    "note" TEXT,
    "playerName" TEXT,
    "relatedPlayerName" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tournaments_slug_key" ON "tournaments"("slug");

-- CreateIndex
CREATE INDEX "tournaments_status_startDate_idx" ON "tournaments"("status", "startDate");

-- CreateIndex
CREATE INDEX "tournament_teams_tournamentId_idx" ON "tournament_teams"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_teams_tournamentId_name_key" ON "tournament_teams"("tournamentId", "name");

-- CreateIndex
CREATE INDEX "tournament_players_tournamentId_teamId_idx" ON "tournament_players"("tournamentId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_players_teamId_jerseyNumber_key" ON "tournament_players"("teamId", "jerseyNumber");

-- CreateIndex
CREATE INDEX "tournament_fixtures_tournamentId_kickoffAt_idx" ON "tournament_fixtures"("tournamentId", "kickoffAt");

-- CreateIndex
CREATE INDEX "tournament_fixtures_tournamentId_stage_round_idx" ON "tournament_fixtures"("tournamentId", "stage", "round");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_fixtures_tournamentId_stage_round_slot_key" ON "tournament_fixtures"("tournamentId", "stage", "round", "slot");

-- CreateIndex
CREATE INDEX "tournament_lineups_fixtureId_teamId_idx" ON "tournament_lineups"("fixtureId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_lineups_fixtureId_playerId_key" ON "tournament_lineups"("fixtureId", "playerId");

-- CreateIndex
CREATE INDEX "tournament_events_fixtureId_createdAt_idx" ON "tournament_events"("fixtureId", "createdAt");

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_teams" ADD CONSTRAINT "tournament_teams_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_players" ADD CONSTRAINT "tournament_players_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "tournament_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_fixtures" ADD CONSTRAINT "tournament_fixtures_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_fixtures" ADD CONSTRAINT "tournament_fixtures_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "tournament_teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_fixtures" ADD CONSTRAINT "tournament_fixtures_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "tournament_teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_fixtures" ADD CONSTRAINT "tournament_fixtures_winnerTeamId_fkey" FOREIGN KEY ("winnerTeamId") REFERENCES "tournament_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_lineups" ADD CONSTRAINT "tournament_lineups_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "tournament_fixtures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_lineups" ADD CONSTRAINT "tournament_lineups_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "tournament_teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_lineups" ADD CONSTRAINT "tournament_lineups_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "tournament_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_events" ADD CONSTRAINT "tournament_events_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "tournament_fixtures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_events" ADD CONSTRAINT "tournament_events_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "tournament_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_events" ADD CONSTRAINT "tournament_events_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "tournament_players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_events" ADD CONSTRAINT "tournament_events_relatedPlayerId_fkey" FOREIGN KEY ("relatedPlayerId") REFERENCES "tournament_players"("id") ON DELETE SET NULL ON UPDATE CASCADE;
