CREATE INDEX IF NOT EXISTS "bookings_turfId_date_status_idx" ON "bookings" ("turfId", "date", "status");
CREATE INDEX IF NOT EXISTS "goals_playerId_idx" ON "goals" ("playerId");
CREATE INDEX IF NOT EXISTS "assists_playerId_idx" ON "assists" ("playerId");
CREATE INDEX IF NOT EXISTS "cards_playerId_type_idx" ON "cards" ("playerId", "type");
