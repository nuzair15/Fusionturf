ALTER TABLE "refresh_tokens"
  ADD COLUMN "userAgent" TEXT,
  ADD COLUMN "ipAddress" TEXT,
  ADD COLUMN "lastUsedAt" TIMESTAMP(3),
  ADD COLUMN "revokedAt" TIMESTAMP(3);

CREATE INDEX "refresh_tokens_expiresAt_revokedAt_idx"
  ON "refresh_tokens"("expiresAt", "revokedAt");
