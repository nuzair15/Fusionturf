CREATE TYPE "FollowType" AS ENUM ('TEAM', 'PLAYER');
CREATE TYPE "RsvpStatus" AS ENUM ('GOING', 'MAYBE', 'NOT_GOING');

CREATE TABLE "user_follows" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "FollowType" NOT NULL,
  "teamId" TEXT,
  "playerId" TEXT,
  "notify" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_follows_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_follows_userId_teamId_key" ON "user_follows"("userId", "teamId");
CREATE UNIQUE INDEX "user_follows_userId_playerId_key" ON "user_follows"("userId", "playerId");
CREATE INDEX "user_follows_userId_type_idx" ON "user_follows"("userId", "type");
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "match_rsvps" (
  "id" TEXT NOT NULL,
  "fixtureId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "RsvpStatus" NOT NULL DEFAULT 'GOING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "match_rsvps_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "match_rsvps_fixtureId_userId_key" ON "match_rsvps"("fixtureId", "userId");
CREATE INDEX "match_rsvps_userId_idx" ON "match_rsvps"("userId");
ALTER TABLE "match_rsvps" ADD CONSTRAINT "match_rsvps_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_rsvps" ADD CONSTRAINT "match_rsvps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "polls" (
  "id" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'PLAYER_OF_MATCH',
  "fixtureId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "closesAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "polls_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "polls_fixtureId_isActive_idx" ON "polls"("fixtureId", "isActive");
ALTER TABLE "polls" ADD CONSTRAINT "polls_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "poll_options" (
  "id" TEXT NOT NULL,
  "pollId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "playerId" TEXT,
  CONSTRAINT "poll_options_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "poll_votes" (
  "id" TEXT NOT NULL,
  "pollId" TEXT NOT NULL,
  "optionId" TEXT NOT NULL,
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "poll_votes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "poll_votes_pollId_userId_key" ON "poll_votes"("pollId", "userId");
CREATE INDEX "poll_votes_optionId_idx" ON "poll_votes"("optionId");
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "poll_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
