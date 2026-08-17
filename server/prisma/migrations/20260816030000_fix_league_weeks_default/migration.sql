-- Fix the leagueWeeks default: a full home-and-away round-robin for the
-- default 6-team format needs 2 * (6 - 1) = 10 weeks (one round per week),
-- not the previous default of 7. That mismatch let generateSeasonFixtures
-- silently schedule an incomplete season (see league-system.ts).
--
-- This only changes the column default for new rows. Existing seasons that
-- were created with the old default of 7 are left as-is here; regenerate
-- their fixtures (or update leagueWeeks manually) if they need a full
-- double round-robin.
ALTER TABLE "seasons" ALTER COLUMN "leagueWeeks" SET DEFAULT 10;
