-- AlterTable
ALTER TABLE "awards" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'PLAYER';
ALTER TABLE "awards" ADD COLUMN IF NOT EXISTS "winnerTeamId" TEXT;

-- CreateIndex (Prisma may need this for FK)
CREATE INDEX IF NOT EXISTS "awards_winnerTeamId_idx" ON "awards"("winnerTeamId");

-- AddForeignKey
ALTER TABLE "awards" ADD CONSTRAINT "awards_winnerTeamId_fkey" FOREIGN KEY ("winnerTeamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: make playerId optional, add teamId
ALTER TABLE "previous_winners" ALTER COLUMN "playerId" DROP NOT NULL;
ALTER TABLE "previous_winners" ADD COLUMN IF NOT EXISTS "teamId" TEXT;

-- AddForeignKey
ALTER TABLE "previous_winners" ADD CONSTRAINT "previous_winners_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
