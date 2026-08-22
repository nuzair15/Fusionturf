-- Additive v2 production data foundation.
-- This migration does not delete, rename, or destructively rewrite legacy data.
-- Take and verify a production backup before deployment.

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'RELEASED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SchedulePreviewStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "MatchEventType" AS ENUM ('GOAL', 'OWN_GOAL', 'PENALTY_GOAL', 'ASSIST', 'YELLOW_CARD', 'SECOND_YELLOW', 'RED_CARD', 'SUBSTITUTION', 'NOTE', 'CLOCK', 'STATE_CHANGE', 'CORRECTION', 'REVERSAL', 'SETTLEMENT');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('PAYMENT_CAPTURED', 'PAYMENT_REFUNDED', 'PAYMENT_ADJUSTED', 'COUPON_REDEEMED', 'COUPON_RELEASED');

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_userId_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_userId_fkey";

-- AlterTable
ALTER TABLE "venues" ADD COLUMN     "deleteReason" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';

-- AlterTable
ALTER TABLE "turfs" ADD COLUMN     "deleteReason" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT;

-- AlterTable
ALTER TABLE "additional_services" ADD COLUMN     "deleteReason" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "customerPhone" TEXT,
ADD COLUMN     "blocksAvailability" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "deleteReason" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "endAt" TIMESTAMP(3),
ADD COLUMN     "guestTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "guestTokenHash" TEXT,
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "quoteSnapshot" JSONB,
ADD COLUMN     "startAt" TIMESTAMP(3),
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "capturedAt" TIMESTAMP(3),
ADD COLUMN     "refundedAt" TIMESTAMP(3),
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "coupons" ADD COLUMN     "deleteReason" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT;

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "deleteReason" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT;

-- AlterTable
ALTER TABLE "seasons" ADD COLUMN     "deleteReason" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT;

-- AlterTable
ALTER TABLE "competitions" ADD COLUMN     "deleteReason" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';

-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "clubId" TEXT,
ADD COLUMN     "deleteReason" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT;

-- AlterTable
ALTER TABLE "players" ADD COLUMN     "deleteReason" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "profileId" TEXT;

-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "deleteReason" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "profileId" TEXT;

-- AlterTable
ALTER TABLE "fixtures" ADD COLUMN     "awayEntryId" TEXT,
ADD COLUMN     "deleteReason" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "finalizedAt" TIMESTAMP(3),
ADD COLUMN     "generationBatchId" TEXT,
ADD COLUMN     "homeEntryId" TEXT,
ADD COLUMN     "kickoffAt" TIMESTAMP(3),
ADD COLUMN     "resultSourceVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scheduledDate" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "match_result_revisions" ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "sourceVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "suspensions" ADD COLUMN     "deleteReason" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT;

-- AlterTable
ALTER TABLE "standing_adjustments" ADD COLUMN     "deleteReason" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT;

-- AlterTable
ALTER TABLE "awards" ADD COLUMN     "deleteReason" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT;

-- AlterTable
ALTER TABLE "news" ADD COLUMN     "deleteReason" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT;

-- AlterTable
ALTER TABLE "galleries" ADD COLUMN     "deleteReason" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT;

-- AlterTable
ALTER TABLE "sponsors" ADD COLUMN     "deleteReason" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT;

-- AlterTable
ALTER TABLE "advertisements" ADD COLUMN     "deleteReason" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT;

-- AlterTable
ALTER TABLE "faqs" ADD COLUMN     "deleteReason" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT;

-- AlterTable
ALTER TABLE "polls" ADD COLUMN     "deleteReason" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "payment_ledger_entries" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "paymentId" TEXT,
    "type" "LedgerEntryType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "idempotencyKey" TEXT NOT NULL,
    "metadata" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_redemptions" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "discountAmount" INTEGER NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clubs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortName" TEXT,
    "logoUrl" TEXT,
    "coverUrl" TEXT,
    "city" TEXT,
    "foundedYear" INTEGER,
    "homeStadium" TEXT,
    "description" TEXT,
    "history" TEXT,
    "achievements" JSONB,
    "website" TEXT,
    "socialLinks" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "deleteReason" TEXT,

    CONSTRAINT "clubs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season_clubs" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "teamId" TEXT,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "deleteReason" TEXT,

    CONSTRAINT "season_clubs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_entries" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "teamId" TEXT,
    "seed" INTEGER,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "deleteReason" TEXT,

    CONSTRAINT "competition_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_rule_sets" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "format" TEXT NOT NULL DEFAULT 'ROUND_ROBIN',
    "legs" INTEGER NOT NULL DEFAULT 2,
    "teamSize" INTEGER NOT NULL DEFAULT 6,
    "starterLimit" INTEGER NOT NULL DEFAULT 6,
    "substituteLimit" INTEGER NOT NULL DEFAULT 2,
    "substitutionLimit" INTEGER NOT NULL DEFAULT 2,
    "matchDurationMinutes" INTEGER NOT NULL DEFAULT 90,
    "extraTimeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "extraTimeMinutes" INTEGER NOT NULL DEFAULT 30,
    "penaltiesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pointsForWin" INTEGER NOT NULL DEFAULT 3,
    "pointsForDraw" INTEGER NOT NULL DEFAULT 1,
    "pointsForLoss" INTEGER NOT NULL DEFAULT 0,
    "tieBreakers" JSONB NOT NULL DEFAULT '["HEAD_TO_HEAD_POINTS","HEAD_TO_HEAD_GOAL_DIFFERENCE","GOAL_DIFFERENCE","GOALS_FOR","TEAM_NAME"]',
    "yellowCardThreshold" INTEGER NOT NULL DEFAULT 2,
    "yellowSuspensionMatches" INTEGER NOT NULL DEFAULT 1,
    "suspensionScope" TEXT NOT NULL DEFAULT 'COMPETITION',
    "minimumRestHours" INTEGER NOT NULL DEFAULT 24,
    "postseasonRules" JSONB NOT NULL DEFAULT '{}',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competition_rule_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_profiles" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "nationality" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "height" INTEGER,
    "weight" INTEGER,
    "preferredFoot" TEXT,
    "photoUrl" TEXT,
    "biography" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "deleteReason" TEXT,

    CONSTRAINT "player_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_registrations" (
    "id" TEXT NOT NULL,
    "playerProfileId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "competitionId" TEXT,
    "clubId" TEXT NOT NULL,
    "teamId" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "jerseyNumber" INTEGER,
    "position" TEXT,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "deleteReason" TEXT,

    CONSTRAINT "player_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_profiles" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "photoUrl" TEXT,
    "biography" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "deleteReason" TEXT,

    CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_registrations" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "teamId" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "role" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "deleteReason" TEXT,

    CONSTRAINT "staff_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixture_generation_batches" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "status" "SchedulePreviewStatus" NOT NULL DEFAULT 'DRAFT',
    "input" JSONB NOT NULL,
    "diff" JSONB NOT NULL,
    "requestedById" TEXT,
    "expiresAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fixture_generation_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_events" (
    "id" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" "MatchEventType" NOT NULL,
    "minute" INTEGER,
    "second" INTEGER,
    "teamIdSnapshot" TEXT,
    "playerProfileIdSnapshot" TEXT,
    "playerRegistrationIdSnapshot" TEXT,
    "secondaryPlayerProfileIdSnapshot" TEXT,
    "payload" JSONB,
    "reversalOfId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projection_versions" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "projection" TEXT NOT NULL,
    "sourceVersion" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "lastBuiltAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projection_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "command_receipts" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "response" JSONB,
    "statusCode" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "command_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "archive_records" (
    "id" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "deleteReason" TEXT,
    "deletedById" TEXT,
    "metadata" JSONB,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restoredById" TEXT,
    "restoredAt" TIMESTAMP(3),

    CONSTRAINT "archive_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_reconciliation_issues" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "matchKey" TEXT NOT NULL,
    "sourceIds" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" JSONB,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identity_reconciliation_issues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_ledger_entries_idempotencyKey_key" ON "payment_ledger_entries"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payment_ledger_entries_bookingId_createdAt_idx" ON "payment_ledger_entries"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "payment_ledger_entries_type_createdAt_idx" ON "payment_ledger_entries"("type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_redemptions_idempotencyKey_key" ON "coupon_redemptions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "coupon_redemptions_couponId_releasedAt_idx" ON "coupon_redemptions"("couponId", "releasedAt");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_redemptions_couponId_bookingId_key" ON "coupon_redemptions"("couponId", "bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "clubs_slug_key" ON "clubs"("slug");

-- CreateIndex
CREATE INDEX "clubs_deletedAt_idx" ON "clubs"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "season_clubs_teamId_key" ON "season_clubs"("teamId");

-- CreateIndex
CREATE INDEX "season_clubs_deletedAt_idx" ON "season_clubs"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "season_clubs_seasonId_clubId_key" ON "season_clubs"("seasonId", "clubId");

-- CreateIndex
CREATE INDEX "competition_entries_deletedAt_idx" ON "competition_entries"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "competition_entries_competitionId_clubId_key" ON "competition_entries"("competitionId", "clubId");

-- CreateIndex
CREATE UNIQUE INDEX "competition_entries_competitionId_teamId_key" ON "competition_entries"("competitionId", "teamId");

-- CreateIndex
CREATE INDEX "competition_rule_sets_competitionId_isActive_idx" ON "competition_rule_sets"("competitionId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "competition_rule_sets_competitionId_version_key" ON "competition_rule_sets"("competitionId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "player_profiles_slug_key" ON "player_profiles"("slug");

-- CreateIndex
CREATE INDEX "player_profiles_deletedAt_idx" ON "player_profiles"("deletedAt");

-- CreateIndex
CREATE INDEX "player_registrations_clubId_validFrom_validTo_idx" ON "player_registrations"("clubId", "validFrom", "validTo");

-- CreateIndex
CREATE INDEX "player_registrations_competitionId_status_idx" ON "player_registrations"("competitionId", "status");

-- CreateIndex
CREATE INDEX "player_registrations_deletedAt_idx" ON "player_registrations"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "player_registrations_playerProfileId_seasonId_validFrom_key" ON "player_registrations"("playerProfileId", "seasonId", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "staff_profiles_slug_key" ON "staff_profiles"("slug");

-- CreateIndex
CREATE INDEX "staff_profiles_deletedAt_idx" ON "staff_profiles"("deletedAt");

-- CreateIndex
CREATE INDEX "staff_registrations_clubId_validFrom_validTo_idx" ON "staff_registrations"("clubId", "validFrom", "validTo");

-- CreateIndex
CREATE INDEX "staff_registrations_deletedAt_idx" ON "staff_registrations"("deletedAt");

-- CreateIndex
CREATE INDEX "fixture_generation_batches_competitionId_status_createdAt_idx" ON "fixture_generation_batches"("competitionId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "match_events_reversalOfId_key" ON "match_events"("reversalOfId");

-- CreateIndex
CREATE UNIQUE INDEX "match_events_idempotencyKey_key" ON "match_events"("idempotencyKey");

-- CreateIndex
CREATE INDEX "match_events_fixtureId_createdAt_idx" ON "match_events"("fixtureId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "match_events_fixtureId_sequence_key" ON "match_events"("fixtureId", "sequence");

-- CreateIndex
CREATE INDEX "projection_versions_status_updatedAt_idx" ON "projection_versions"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "projection_versions_competitionId_projection_key" ON "projection_versions"("competitionId", "projection");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_idempotencyKey_key" ON "outbox_events"("idempotencyKey");

-- CreateIndex
CREATE INDEX "outbox_events_status_availableAt_idx" ON "outbox_events"("status", "availableAt");

-- CreateIndex
CREATE INDEX "outbox_events_aggregateType_aggregateId_idx" ON "outbox_events"("aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "command_receipts_expiresAt_idx" ON "command_receipts"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "command_receipts_scope_key_key" ON "command_receipts"("scope", "key");

-- CreateIndex
CREATE INDEX "archive_records_restoredAt_deletedAt_idx" ON "archive_records"("restoredAt", "deletedAt");

-- CreateIndex
CREATE INDEX "archive_records_resourceType_restoredAt_idx" ON "archive_records"("resourceType", "restoredAt");

-- CreateIndex
CREATE INDEX "archive_records_resourceType_resourceId_idx" ON "archive_records"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "identity_reconciliation_issues_status_entityType_idx" ON "identity_reconciliation_issues"("status", "entityType");

-- CreateIndex
CREATE UNIQUE INDEX "identity_reconciliation_issues_entityType_matchKey_key" ON "identity_reconciliation_issues"("entityType", "matchKey");

-- CreateIndex
CREATE INDEX "venues_deletedAt_idx" ON "venues"("deletedAt");

-- CreateIndex
CREATE INDEX "turfs_deletedAt_idx" ON "turfs"("deletedAt");

-- CreateIndex
CREATE INDEX "additional_services_deletedAt_idx" ON "additional_services"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_idempotencyKey_key" ON "bookings"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_guestTokenHash_key" ON "bookings"("guestTokenHash");

-- CreateIndex
CREATE INDEX "bookings_deletedAt_idx" ON "bookings"("deletedAt");

-- CreateIndex
CREATE INDEX "bookings_turfId_startAt_endAt_idx" ON "bookings"("turfId", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "coupons_deletedAt_idx" ON "coupons"("deletedAt");

-- CreateIndex
CREATE INDEX "reviews_deletedAt_idx" ON "reviews"("deletedAt");

-- CreateIndex
CREATE INDEX "seasons_deletedAt_idx" ON "seasons"("deletedAt");

-- CreateIndex
CREATE INDEX "competitions_deletedAt_idx" ON "competitions"("deletedAt");

-- CreateIndex
CREATE INDEX "teams_clubId_idx" ON "teams"("clubId");

-- CreateIndex
CREATE INDEX "teams_deletedAt_idx" ON "teams"("deletedAt");

-- CreateIndex
CREATE INDEX "players_profileId_idx" ON "players"("profileId");

-- CreateIndex
CREATE INDEX "players_deletedAt_idx" ON "players"("deletedAt");

-- CreateIndex
CREATE INDEX "staff_profileId_idx" ON "staff"("profileId");

-- CreateIndex
CREATE INDEX "staff_deletedAt_idx" ON "staff"("deletedAt");

-- CreateIndex
CREATE INDEX "fixtures_deletedAt_idx" ON "fixtures"("deletedAt");

-- CreateIndex
CREATE INDEX "fixtures_scheduledDate_kickoffAt_id_idx" ON "fixtures"("scheduledDate", "kickoffAt", "id");

-- CreateIndex
CREATE INDEX "fixtures_generationBatchId_idx" ON "fixtures"("generationBatchId");

-- CreateIndex
CREATE INDEX "fixtures_homeEntryId_idx" ON "fixtures"("homeEntryId");

-- CreateIndex
CREATE INDEX "fixtures_awayEntryId_idx" ON "fixtures"("awayEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "match_result_revisions_idempotencyKey_key" ON "match_result_revisions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "suspensions_deletedAt_idx" ON "suspensions"("deletedAt");

-- CreateIndex
CREATE INDEX "standing_adjustments_deletedAt_idx" ON "standing_adjustments"("deletedAt");

-- CreateIndex
CREATE INDEX "awards_deletedAt_idx" ON "awards"("deletedAt");

-- CreateIndex
CREATE INDEX "news_deletedAt_idx" ON "news"("deletedAt");

-- CreateIndex
CREATE INDEX "galleries_deletedAt_idx" ON "galleries"("deletedAt");

-- CreateIndex
CREATE INDEX "sponsors_deletedAt_idx" ON "sponsors"("deletedAt");

-- CreateIndex
CREATE INDEX "advertisements_deletedAt_idx" ON "advertisements"("deletedAt");

-- CreateIndex
CREATE INDEX "faqs_deletedAt_idx" ON "faqs"("deletedAt");

-- CreateIndex
CREATE INDEX "polls_deletedAt_idx" ON "polls"("deletedAt");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_ledger_entries" ADD CONSTRAINT "payment_ledger_entries_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_ledger_entries" ADD CONSTRAINT "payment_ledger_entries_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_clubs" ADD CONSTRAINT "season_clubs_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_clubs" ADD CONSTRAINT "season_clubs_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_clubs" ADD CONSTRAINT "season_clubs_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_entries" ADD CONSTRAINT "competition_entries_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_entries" ADD CONSTRAINT "competition_entries_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_entries" ADD CONSTRAINT "competition_entries_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_rule_sets" ADD CONSTRAINT "competition_rule_sets_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_registrations" ADD CONSTRAINT "player_registrations_playerProfileId_fkey" FOREIGN KEY ("playerProfileId") REFERENCES "player_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_registrations" ADD CONSTRAINT "player_registrations_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_registrations" ADD CONSTRAINT "player_registrations_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_registrations" ADD CONSTRAINT "player_registrations_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_registrations" ADD CONSTRAINT "player_registrations_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_registrations" ADD CONSTRAINT "staff_registrations_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_registrations" ADD CONSTRAINT "staff_registrations_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "player_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_homeEntryId_fkey" FOREIGN KEY ("homeEntryId") REFERENCES "competition_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_awayEntryId_fkey" FOREIGN KEY ("awayEntryId") REFERENCES "competition_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_generationBatchId_fkey" FOREIGN KEY ("generationBatchId") REFERENCES "fixture_generation_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixture_generation_batches" ADD CONSTRAINT "fixture_generation_batches_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixture_generation_batches" ADD CONSTRAINT "fixture_generation_batches_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "match_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projection_versions" ADD CONSTRAINT "projection_versions_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Backfill permanent club identities only where the legacy key is unambiguous.
INSERT INTO "clubs" (
  "id", "name", "slug", "isActive", "createdAt", "updatedAt"
)
SELECT
  md5('club:' || lower(t."slug")),
  min(t."name"),
  lower(t."slug"),
  bool_or(t."isActive"),
  min(t."createdAt"),
  CURRENT_TIMESTAMP
FROM "teams" t
GROUP BY lower(t."slug")
HAVING count(DISTINCT lower(trim(t."name"))) = 1
ON CONFLICT ("slug") DO NOTHING;

UPDATE "teams" t
SET "clubId" = c."id"
FROM "clubs" c
WHERE lower(t."slug") = c."slug" AND t."clubId" IS NULL;

INSERT INTO "identity_reconciliation_issues" (
  "id", "entityType", "matchKey", "sourceIds", "reason", "createdAt", "updatedAt"
)
SELECT
  md5('club-issue:' || lower(t."slug")),
  'CLUB',
  lower(t."slug"),
  jsonb_agg(t."id" ORDER BY t."createdAt"),
  'Legacy teams share a slug but disagree on the club name',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "teams" t
GROUP BY lower(t."slug")
HAVING count(DISTINCT lower(trim(t."name"))) > 1
ON CONFLICT ("entityType", "matchKey") DO NOTHING;

INSERT INTO "season_clubs" (
  "id", "seasonId", "clubId", "teamId", "status", "createdAt", "updatedAt"
)
SELECT
  md5('season-club:' || t."id"),
  t."seasonId",
  t."clubId",
  t."id",
  CASE WHEN t."isActive" THEN 'ACTIVE'::"RegistrationStatus" ELSE 'EXPIRED'::"RegistrationStatus" END,
  t."createdAt",
  CURRENT_TIMESTAMP
FROM "teams" t
WHERE t."clubId" IS NOT NULL
ON CONFLICT ("seasonId", "clubId") DO NOTHING;

INSERT INTO "competition_entries" (
  "id", "competitionId", "clubId", "teamId", "status", "createdAt", "updatedAt"
)
SELECT
  md5('competition-entry:' || c."id" || ':' || t."id"),
  c."id",
  t."clubId",
  t."id",
  CASE WHEN t."isActive" THEN 'ACTIVE'::"RegistrationStatus" ELSE 'EXPIRED'::"RegistrationStatus" END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "competitions" c
JOIN "teams" t ON t."seasonId" = c."seasonId"
WHERE t."clubId" IS NOT NULL
ON CONFLICT ("competitionId", "clubId") DO NOTHING;

INSERT INTO "competition_rule_sets" (
  "id", "competitionId", "version", "isActive", "createdAt"
)
SELECT md5('rules:' || c."id" || ':1'), c."id", 1, true, CURRENT_TIMESTAMP
FROM "competitions" c
ON CONFLICT ("competitionId", "version") DO NOTHING;

-- Player profiles are merged only for exact legacy slug/name/date-of-birth matches.
INSERT INTO "player_profiles" (
  "id", "slug", "firstName", "lastName", "nationality", "dateOfBirth",
  "isActive", "createdAt", "updatedAt"
)
SELECT
  md5('player-profile:' || lower(p."slug")),
  lower(p."slug"),
  min(p."firstName"),
  min(p."lastName"),
  min(p."nationality"),
  min(p."dateOfBirth"),
  bool_or(p."isActive"),
  min(p."createdAt"),
  CURRENT_TIMESTAMP
FROM "players" p
GROUP BY lower(p."slug")
HAVING count(DISTINCT lower(trim(p."firstName") || ' ' || trim(p."lastName"))) = 1
   AND count(DISTINCT coalesce(p."dateOfBirth"::text, '')) <= 1
ON CONFLICT ("slug") DO NOTHING;

UPDATE "players" p
SET "profileId" = pp."id"
FROM "player_profiles" pp
WHERE lower(p."slug") = pp."slug" AND p."profileId" IS NULL;

INSERT INTO "identity_reconciliation_issues" (
  "id", "entityType", "matchKey", "sourceIds", "reason", "createdAt", "updatedAt"
)
SELECT
  md5('player-issue:' || lower(p."slug")),
  'PLAYER',
  lower(p."slug"),
  jsonb_agg(p."id" ORDER BY p."createdAt"),
  'Legacy players share a slug but disagree on identity attributes',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "players" p
GROUP BY lower(p."slug")
HAVING count(DISTINCT lower(trim(p."firstName") || ' ' || trim(p."lastName"))) > 1
    OR count(DISTINCT coalesce(p."dateOfBirth"::text, '')) > 1
ON CONFLICT ("entityType", "matchKey") DO NOTHING;

INSERT INTO "player_registrations" (
  "id", "playerProfileId", "seasonId", "clubId", "teamId", "validFrom",
  "validTo", "jerseyNumber", "position", "status", "createdAt", "updatedAt"
)
SELECT
  md5('player-registration:' || p."id"),
  p."profileId",
  p."seasonId",
  t."clubId",
  p."teamId",
  s."startDate",
  s."endDate",
  p."jerseyNumber",
  p."position",
  CASE WHEN p."isActive" THEN 'ACTIVE'::"RegistrationStatus" ELSE 'EXPIRED'::"RegistrationStatus" END,
  p."createdAt",
  CURRENT_TIMESTAMP
FROM "players" p
JOIN "seasons" s ON s."id" = p."seasonId"
JOIN "teams" t ON t."id" = p."teamId"
WHERE p."profileId" IS NOT NULL AND t."clubId" IS NOT NULL
ON CONFLICT ("playerProfileId", "seasonId", "validFrom") DO NOTHING;

-- Staff records have no reliable legacy identity key, so each is preserved as
-- its own profile and can be reconciled explicitly by an administrator later.
INSERT INTO "staff_profiles" (
  "id", "slug", "firstName", "lastName", "photoUrl", "createdAt", "updatedAt"
)
SELECT
  md5('staff-profile:' || s."id"),
  lower(regexp_replace(trim(s."firstName" || '-' || s."lastName"), '[^a-zA-Z0-9]+', '-', 'g'))
    || '-' || substr(md5(s."id"), 1, 8),
  s."firstName",
  s."lastName",
  s."photoUrl",
  s."createdAt",
  CURRENT_TIMESTAMP
FROM "staff" s
ON CONFLICT ("slug") DO NOTHING;

UPDATE "staff" s
SET "profileId" = sp."id"
FROM "staff_profiles" sp
WHERE sp."id" = md5('staff-profile:' || s."id") AND s."profileId" IS NULL;

INSERT INTO "staff_registrations" (
  "id", "staffProfileId", "clubId", "teamId", "validFrom", "validTo",
  "role", "status", "createdAt", "updatedAt"
)
SELECT
  md5('staff-registration:' || s."id"),
  s."profileId",
  t."clubId",
  t."id",
  se."startDate",
  se."endDate",
  s."role",
  'ACTIVE'::"RegistrationStatus",
  s."createdAt",
  CURRENT_TIMESTAMP
FROM "staff" s
JOIN "teams" t ON t."id" = s."teamId"
JOIN "seasons" se ON se."id" = t."seasonId"
WHERE s."profileId" IS NOT NULL AND t."clubId" IS NOT NULL;

-- Add canonical date-only and UTC kickoff values without changing legacy fields.
UPDATE "fixtures" f
SET
  "scheduledDate" = to_char(f."matchDate"::date, 'YYYY-MM-DD'),
  "kickoffAt" = CASE
    WHEN f."kickoffTime" ~ '^[0-2][0-9]:[0-5][0-9]$'
    THEN (f."matchDate"::date + f."kickoffTime"::time)
      AT TIME ZONE coalesce(
        (SELECT c."timezone" FROM "competitions" c WHERE c."id" = f."competitionId"),
        (SELECT v."timezone" FROM "venues" v WHERE v."id" = f."venueId"),
        'Asia/Kolkata'
      )
    ELSE NULL
  END,
  "homeEntryId" = (
    SELECT ce."id" FROM "competition_entries" ce
    WHERE ce."competitionId" = f."competitionId" AND ce."teamId" = f."homeTeamId"
    LIMIT 1
  ),
  "awayEntryId" = (
    SELECT ce."id" FROM "competition_entries" ce
    WHERE ce."competitionId" = f."competitionId" AND ce."teamId" = f."awayTeamId"
    LIMIT 1
  );

-- Backfill UTC booking intervals and immutable guest/contact snapshots.
UPDATE "bookings" b
SET
  "blocksAvailability" = b."status" IN ('PENDING', 'CONFIRMED', 'RESCHEDULED'),
  "customerName" = coalesce(
    b."customerName",
    (SELECT nullif(trim(u."firstName" || ' ' || u."lastName"), '') FROM "users" u WHERE u."id" = b."userId")
  ),
  "customerPhone" = coalesce(
    b."customerPhone",
    (SELECT u."phone" FROM "users" u WHERE u."id" = b."userId")
  ),
  "customerEmail" = coalesce(
    b."customerEmail",
    (SELECT u."email" FROM "users" u WHERE u."id" = b."userId")
  ),
  "startAt" = CASE
    WHEN b."startTime" ~ '^[0-2][0-9]:[0-5][0-9]$'
    THEN (b."date"::date + b."startTime"::time) AT TIME ZONE coalesce(v."timezone", 'Asia/Kolkata')
    ELSE NULL
  END,
  "endAt" = CASE
    WHEN b."endTime" ~ '^[0-2][0-9]:[0-5][0-9]$'
    THEN (
      b."date"::date
      + b."endTime"::time
      + CASE WHEN b."endTime" <= b."startTime" THEN interval '1 day' ELSE interval '0 day' END
    ) AT TIME ZONE coalesce(v."timezone", 'Asia/Kolkata')
    ELSE NULL
  END
FROM "turfs" t
JOIN "venues" v ON v."id" = t."venueId"
WHERE t."id" = b."turfId";

-- Defaults were used only to make the additive NOT NULL columns safe for
-- existing rows. Prisma owns their updatedAt values on subsequent writes.
ALTER TABLE "additional_services" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "polls" ALTER COLUMN "updatedAt" DROP DEFAULT;

UPDATE "payments"
SET
  "capturedAt" = CASE WHEN "status" IN ('PAID', 'REFUNDED', 'PARTIALLY_REFUNDED') THEN "updatedAt" ELSE NULL END,
  "refundedAt" = CASE WHEN "status" IN ('REFUNDED', 'PARTIALLY_REFUNDED') THEN "updatedAt" ELSE NULL END;

INSERT INTO "payment_ledger_entries" (
  "id", "bookingId", "paymentId", "type", "amount", "currency",
  "idempotencyKey", "metadata", "createdAt"
)
SELECT
  md5('payment-capture:' || p."id"),
  p."bookingId",
  p."id",
  'PAYMENT_CAPTURED'::"LedgerEntryType",
  p."amount",
  p."currency",
  'backfill:capture:' || p."id",
  jsonb_build_object('source', 'legacy-payment-backfill'),
  coalesce(p."capturedAt", p."createdAt")
FROM "payments" p
WHERE p."status" IN ('PAID', 'REFUNDED', 'PARTIALLY_REFUNDED')
ON CONFLICT ("idempotencyKey") DO NOTHING;

INSERT INTO "payment_ledger_entries" (
  "id", "bookingId", "paymentId", "type", "amount", "currency",
  "idempotencyKey", "metadata", "createdAt"
)
SELECT
  md5('payment-refund:' || p."id"),
  p."bookingId",
  p."id",
  'PAYMENT_REFUNDED'::"LedgerEntryType",
  CASE WHEN p."refundAmount" > 0 THEN p."refundAmount" ELSE p."amount" END,
  p."currency",
  'backfill:refund:' || p."id",
  jsonb_build_object('source', 'legacy-payment-backfill'),
  coalesce(p."refundedAt", p."updatedAt")
FROM "payments" p
WHERE p."status" IN ('REFUNDED', 'PARTIALLY_REFUNDED')
ON CONFLICT ("idempotencyKey") DO NOTHING;

INSERT INTO "coupon_redemptions" (
  "id", "couponId", "bookingId", "discountAmount", "releasedAt",
  "idempotencyKey", "createdAt"
)
SELECT
  md5('coupon-redemption:' || c."id" || ':' || b."id"),
  c."id",
  b."id",
  b."discountAmount",
  CASE WHEN b."status" = 'CANCELLED' THEN b."updatedAt" ELSE NULL END,
  'backfill:coupon:' || c."id" || ':' || b."id",
  b."createdAt"
FROM "bookings" b
JOIN "coupons" c ON lower(c."code") = lower(b."couponCode")
WHERE b."discountAmount" > 0
ON CONFLICT ("couponId", "bookingId") DO NOTHING;

-- Existing rows are preserved; these NOT VALID checks protect all new writes
-- and can be validated after reconciliation reports are clear.
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_different_teams_check"
  CHECK ("homeTeamId" <> "awayTeamId") NOT VALID;
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_nonnegative_scores_check"
  CHECK (
    ("homeScore" IS NULL OR "homeScore" >= 0)
    AND ("awayScore" IS NULL OR "awayScore" >= 0)
    AND ("extraTimeHomeScore" IS NULL OR "extraTimeHomeScore" >= 0)
    AND ("extraTimeAwayScore" IS NULL OR "extraTimeAwayScore" >= 0)
    AND ("penaltiesHomeScore" IS NULL OR "penaltiesHomeScore" >= 0)
    AND ("penaltiesAwayScore" IS NULL OR "penaltiesAwayScore" >= 0)
  ) NOT VALID;
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_possession_range_check"
  CHECK (
    ("homePossession" IS NULL OR "homePossession" BETWEEN 0 AND 100)
    AND ("awayPossession" IS NULL OR "awayPossession" BETWEEN 0 AND 100)
  ) NOT VALID;
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_winner_participant_check"
  CHECK ("winnerTeamId" IS NULL OR "winnerTeamId" IN ("homeTeamId", "awayTeamId")) NOT VALID;
ALTER TABLE "competition_rule_sets" ADD CONSTRAINT "competition_rule_sets_valid_ranges_check"
  CHECK (
    "legs" BETWEEN 1 AND 4
    AND "teamSize" > 0
    AND "starterLimit" > 0
    AND "substituteLimit" >= 0
    AND "substitutionLimit" >= 0
    AND "matchDurationMinutes" > 0
    AND "yellowCardThreshold" > 0
    AND "minimumRestHours" >= 0
  );
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_valid_time_check"
  CHECK (
    ("minute" IS NULL OR "minute" >= 0)
    AND ("second" IS NULL OR "second" BETWEEN 0 AND 59)
  );
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_valid_utc_interval_check"
  CHECK ("startAt" IS NULL OR "endAt" IS NULL OR "endAt" > "startAt") NOT VALID;
ALTER TABLE "payment_ledger_entries" ADD CONSTRAINT "payment_ledger_positive_amount_check"
  CHECK ("amount" > 0);

CREATE UNIQUE INDEX "seasons_one_current_active_idx"
  ON "seasons" ((true))
  WHERE "isCurrent" = true AND "deletedAt" IS NULL;
CREATE UNIQUE INDEX "competition_rule_sets_one_active_idx"
  ON "competition_rule_sets" ("competitionId")
  WHERE "isActive" = true;
CREATE UNIQUE INDEX "archive_records_one_open_idx"
  ON "archive_records" ("resourceType", "resourceId")
  WHERE "restoredAt" IS NULL;

CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_active_overlap"
  EXCLUDE USING gist (
    "turfId" WITH =,
    tsrange("startAt", "endAt", '[)') WITH &&
  )
  WHERE (
    "deletedAt" IS NULL
    AND "startAt" IS NOT NULL
    AND "endAt" IS NOT NULL
    AND "blocksAvailability" = true
  );

-- Domain ledgers are append-only. Reversals/refunds are new entries.
CREATE OR REPLACE FUNCTION reject_immutable_row_change()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; create a reversal/correction entry instead', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "match_events_append_only"
BEFORE UPDATE OR DELETE ON "match_events"
FOR EACH ROW EXECUTE FUNCTION reject_immutable_row_change();

CREATE TRIGGER "payment_ledger_entries_append_only"
BEFORE UPDATE OR DELETE ON "payment_ledger_entries"
FOR EACH ROW EXECUTE FUNCTION reject_immutable_row_change();
