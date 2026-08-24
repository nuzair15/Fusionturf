-- Fusion Turf fixtures are 6-a-side, 60-minute matches. Keep the rule-set
-- default and existing configured competitions aligned with that duration.
ALTER TABLE "competition_rule_sets"
  ALTER COLUMN "matchDurationMinutes" SET DEFAULT 60;

UPDATE "competition_rule_sets"
SET "matchDurationMinutes" = 60
WHERE "matchDurationMinutes" = 90;
