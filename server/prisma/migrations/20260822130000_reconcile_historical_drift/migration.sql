-- Reconcile historical schema changes that predated the migration baseline.
-- No rows are deleted or rewritten.

-- DropForeignKey
ALTER TABLE "match_appearances" DROP CONSTRAINT "match_appearances_fixtureId_fkey";

-- DropForeignKey
ALTER TABLE "match_appearances" DROP CONSTRAINT "match_appearances_playerId_fkey";

-- DropForeignKey
ALTER TABLE "previous_winners" DROP CONSTRAINT "previous_winners_playerId_fkey";

-- AlterTable
ALTER TABLE "lineups" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active';

-- AddForeignKey
ALTER TABLE "match_notes" ADD CONSTRAINT "match_notes_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_appearances" ADD CONSTRAINT "match_appearances_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_appearances" ADD CONSTRAINT "match_appearances_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "previous_winners" ADD CONSTRAINT "previous_winners_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;


