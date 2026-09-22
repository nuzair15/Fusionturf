ALTER TYPE "RegistrationStatus" ADD VALUE IF NOT EXISTS 'INACTIVE';
ALTER TABLE "seasons" ADD COLUMN "lifecycle" TEXT NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "sourceSeasonId" TEXT,
  ADD COLUMN "rolloverKey" TEXT,
  ADD COLUMN "rolloverReport" JSONB,
  ADD COLUMN "activatedAt" TIMESTAMP(3);
-- Preserve the visibility of existing seasons. Do not infer completion from dates.
UPDATE "seasons" SET "lifecycle" = 'ACTIVE';
CREATE UNIQUE INDEX "seasons_sourceSeasonId_key" ON "seasons"("sourceSeasonId");
CREATE UNIQUE INDEX "seasons_rolloverKey_key" ON "seasons"("rolloverKey");
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_lifecycle_check" CHECK ("lifecycle" IN ('DRAFT', 'ACTIVE', 'COMPLETED'));
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_current_published_check" CHECK (NOT "isCurrent" OR "lifecycle" = 'ACTIVE');
ALTER TABLE "players" ADD COLUMN "activityReason" TEXT, ADD COLUMN "activityChangedAt" TIMESTAMP(3);
ALTER TABLE "player_stats" ADD COLUMN "manualOverrides" JSONB;
ALTER TABLE "friendly_player_stats" ADD COLUMN "manualOverrides" JSONB;
-- A same-season legacy person must be reconciled before enforcing identity uniqueness.
-- Existing conflicting records are preserved; new writes are serialized by identity.
