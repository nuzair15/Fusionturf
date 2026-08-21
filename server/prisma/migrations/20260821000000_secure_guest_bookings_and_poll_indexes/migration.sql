-- Stores a guest's supplied contact address without associating it with an
-- existing User account. Review and deploy with the normal migration process.
ALTER TABLE "bookings" ADD COLUMN "customerEmail" TEXT;

-- Supports server-side poll option membership checks and vote aggregation.
CREATE INDEX "poll_options_pollId_id_idx" ON "poll_options"("pollId", "id");
CREATE INDEX "poll_votes_pollId_optionId_idx" ON "poll_votes"("pollId", "optionId");
