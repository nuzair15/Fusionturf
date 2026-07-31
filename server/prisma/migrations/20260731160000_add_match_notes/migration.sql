-- CreateTable
CREATE TABLE "match_notes" (
    "id" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "teamId" TEXT,
    "playerId" TEXT,
    "type" TEXT NOT NULL,
    "minute" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "match_notes_fixtureId_idx" ON "match_notes"("fixtureId");

-- AddForeignKey
ALTER TABLE "match_notes" ADD CONSTRAINT "match_notes_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
