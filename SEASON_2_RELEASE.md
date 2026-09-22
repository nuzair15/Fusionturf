# Season transition and history release

Implemented locally on 2026-09-21. The Git checkout started on `main` at `5c3b991`, with no changes and no commits ahead of or behind fetched `origin/main`. See [EC2_RELEASE.md](EC2_RELEASE.md) for deployment commands. A Git push does not apply these changes to the live database or website.

## Delivered behavior

- Admin → League → Prepare next season shows a roster preview and exclusions, accepts real season dates, and creates a private draft. Returning active players keep their existing clubs. Staff assignments can continue; sponsor renewal is optional. Managers and team metadata carry forward.
- Draft creation preserves permanent club/player identities and source records, creates zero standings, and prevents duplicate rollover on retries or concurrent submissions. Fixtures, results, player statistics, bans, votes, and award winners do not copy.
- Admin → Players supports active/inactive/all filters, audited deactivation/reactivation, and registering a returning player through the permanent player directory. Upcoming squad removal needs explicit confirmation; live-match participants cannot be deactivated/transferred. Historical squads and stats remain intact. Transfers stay within a season and obey its transfer-window dates.
- Readiness checks block activation for incomplete rosters, identities, registrations, league rules, dates or scheduling, unfinished source fixtures, and pending projections. Activation atomically makes the draft current, closes the old season, and reserves match slots. A booking conflict rolls back the whole activation. Completed seasons are protected from ordinary roster changes and recycle-bin archive/restore operations; privileged match corrections require a reason.
- Historical recalculation retains inactive players, attributes performances to their match teams, and preserves explicit manual overrides. Player pages expose season history and separate career totals. Follows resolve the club/person across seasons.
- `/league/seasons` lists published seasons. Each detailed overview includes standings, fixtures/results with events, player statistics, squads/staff, and announced awards. Season selectors are available on league, standings, statistics, fixture and profile pages.
- Admin → Teams → Add/Edit → Team hero banner uploads a separate wide team image using the existing image uploader. The club directory and team header show it. Upload, replace, preview and remove are supported. It is saved on the season team and permanent club, and copied to the next season; historical season images remain their own snapshots.

## Public HTML and structured data

These routes return data directly without requiring JavaScript execution:

- `/api/league/seasons/index.html`: published-season index.
- `/api/league/seasons/{slug}/overview.html`: complete readable HTML overview, with tables and JSON-LD metadata.
- `/api/league/seasons/{slug}/overview`: allowlisted JSON, `schemaVersion: "1.0"`, generation timestamp, season, summary, competitions, teams, standings, fixtures, aggregated and per-team league stats, friendly stats, and awards.
- `/llms.txt`: generated at frontend build time, with discovery links respecting `VITE_API_URL`. The initial frontend HTML also links to the readable season index before React runs.

Drafts, accounts, payments, admin notes, inactivity reasons, and unannounced winners are excluded from the overview export. AI tools can fetch the HTML or JSON directly; discovery files do not guarantee that any particular crawler will index the site. Season stats and career totals are distinct, and league/friendly statistics remain separate.

## Verification performed

- Applied all 30 migrations to an isolated local PostgreSQL database and generated Prisma.
- Server: 67 tests passed, including 14 PostgreSQL integration scenarios. Coverage includes stale previews, duplicate/concurrent rollover, injected rollback failure, inactivity, squad cleanup, shared identities, hero-banner persistence/carry-over, draft visibility, booking-conflict rollback, ban reset, historical profiles, follow continuity, and public export exclusions.
- Client: 12 tests passed. Both production builds and bundle-budget checks passed.
- Browser: created a draft, checked disabled activation and blocker messages, marked a player inactive and filtered the list, opened archived results/squads, and read complete HTML with JavaScript disabled.
- Public smoke checks returned HTTP 200 for 14 routes, including team/player profiles, league/friendly leaderboards, fixtures, season exports, and discovery links. The read-only season audit completed on the isolated database.
- Banner browser flow checks file selection, upload preview, persistence, directory/header rendering and narrow-screen layout. The external image-storage response is mocked for this check; no test files are uploaded to the production Cloudinary account.

## Deployment and real-data rehearsal

1. Take a database backup and verify its restoration into an isolated staging environment. Record source rosters, results, standings, stats, bans, and bookings. This production-snapshot rehearsal has **not** been performed here.
2. In staging, generate the Prisma client, apply migrations with `npm run db:migrate --prefix server`, then build and deploy matching server/client versions together. The additive migration marks existing seasons `ACTIVE` to preserve their visibility; it does not guess completion from their dates.
3. Run `npm run season:audit --prefix server` against staging first. It is read-only by default. Review missing identities, duplicate profiles, mismatched teams, unattached players and reconciliation issues. The optional `-- --repair-identities` writes identity links and registrations without merging people by name. Rehearse and review its report before applying it to live data. Resolve ambiguous identity matches manually.
4. Compare historical statistics to the baseline before any rebuild. Old manually edited derived fields have no override provenance; review and re-save intended overrides through the new stats editor before rebuilding. New explicit overrides are retained by recalculation. Resolve unexplained differences rather than overwriting the baseline.
5. Prepare the next-season draft, review every exclusion and roster assignment, adjust registrations/transfers, confirm sponsor choices, prepare fixtures, and resolve all readiness blockers. Draft fixtures do not reserve booking slots until activation, so slots must still be available when activating.
6. Rehearse activation and read back Season 1 alongside Season 2. Check bans, stats, awards, profiles, follows, banners, and reservations. New stats/bans must be zero; historical records must remain available.
7. For release, deploy the migration/builds with a verified backup, repeat the read-only audit and reviewed preparation against live data, and activate only the reviewed draft. Confirm `FRONTEND_URL`, `VITE_API_URL`, CORS settings and existing Cloudinary credentials match the production domains. Check HTML/JSON/llms links from the deployed frontend.

An unlaunched draft can be kept private while problems are corrected. A created rollover retains its source association to prevent duplicate copies; there is no automatic destructive reset/retry of a discarded draft. After activation and new match activity, use audited corrections and a reviewed recovery plan. A full database restore is not a routine season undo because it could erase unrelated bookings or payments.

## Repeating integration tests

Set `SEASON_TEST_DATABASE_URL` to an isolated local database whose name ends in `_test`, apply migrations there, then run `npm test --prefix server`. The integration suite intentionally creates synthetic league records and changes that test database's current season. Without this variable, database integration tests are skipped. Never point this suite at real league data.
