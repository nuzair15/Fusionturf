-- Preserve every legacy match action in the append-only v2 authority before
-- controllers begin treating legacy tables as compatibility projections.
WITH legacy_events AS (
  SELECT g."fixtureId", g.id AS legacy_id, 'goal'::text AS legacy_type,
    CASE WHEN g."isOwnGoal" THEN 'OWN_GOAL' WHEN g."isPenalty" THEN 'PENALTY_GOAL' ELSE 'GOAL' END AS event_type,
    g.minute, g."teamId", g."playerId", NULL::text AS secondary_player_id, g."createdAt" AS event_at
  FROM "goals" g
  UNION ALL
  SELECT a."fixtureId", a.id, 'assist', 'ASSIST', a.minute, a."teamId", a."playerId", NULL::text, a."createdAt" FROM "assists" a
  UNION ALL
  SELECT c."fixtureId", c.id, 'card',
    CASE WHEN c.type::text = 'YELLOW' THEN 'YELLOW_CARD' WHEN c.type::text = 'SECOND_YELLOW' THEN 'SECOND_YELLOW' ELSE 'RED_CARD' END,
    c.minute, c."teamId", c."playerId", NULL::text, c."createdAt" FROM "cards" c
  UNION ALL
  SELECT s."fixtureId", s.id, 'substitution', 'SUBSTITUTION', s.minute, s."teamId", s."playerOffId", s."playerOnId", s."createdAt" FROM "substitutions" s
  UNION ALL
  SELECT n."fixtureId", n.id, 'note', 'NOTE', n.minute, n."teamId", n."playerId", NULL::text, n."createdAt" FROM "match_notes" n
), ranked AS (
  SELECT e.*, row_number() OVER (PARTITION BY e."fixtureId" ORDER BY e.event_at, e.legacy_type, e.legacy_id) AS event_sequence
  FROM legacy_events e
), bases AS (
  SELECT "fixtureId", COALESCE(MAX(sequence), 0) AS base_sequence FROM "match_events" GROUP BY "fixtureId"
)
INSERT INTO "match_events" (
  id, "fixtureId", sequence, type, minute, "teamIdSnapshot",
  "playerProfileIdSnapshot", "secondaryPlayerProfileIdSnapshot", payload,
  "idempotencyKey", "createdAt"
)
SELECT
  md5('match-event:' || r.legacy_type || ':' || r.legacy_id),
  r."fixtureId",
  COALESCE(b.base_sequence, 0) + r.event_sequence,
  r.event_type::"MatchEventType",
  r.minute,
  r."teamId",
  p."profileId",
  secondary."profileId",
  jsonb_build_object('legacyType', r.legacy_type, 'legacyId', r.legacy_id, 'backfilled', true),
  'legacy:' || r.legacy_type || ':' || r.legacy_id || ':created',
  r.event_at
FROM ranked r
LEFT JOIN bases b ON b."fixtureId" = r."fixtureId"
LEFT JOIN "players" p ON p.id = r."playerId"
LEFT JOIN "players" secondary ON secondary.id = r.secondary_player_id
ON CONFLICT ("idempotencyKey") DO NOTHING;
