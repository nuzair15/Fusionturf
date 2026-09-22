# Season 2 readiness plan

Originally reviewed 2026-09-21 against local commit `5c3b991`. The findings below describe that baseline. The implementation is now present in the working tree; see [SEASON_2_RELEASE.md](SEASON_2_RELEASE.md) for delivered behavior, verification, and deployment steps. Production records and deployment have not been changed or audited.

Decisions confirmed by the owner:

- Returning players remain with their existing clubs by default. Individual transfers happen afterward.
- All bans reset for Season 2. Season 1 cards, bans, and served-match records remain in historical records.

## What happened in the original implementation

The admin **Create Next Season** button calls `POST /admin/seasons/:id/create-next`. The service creates new season-specific teams and players, reuses permanent club/player identities when linked, creates one league competition and its rules, and registers the copied players. It does this in a serializable transaction with a source-season advisory lock. Those are useful existing foundations.

However, it immediately changes the current season. The UI asks only for a name and supplies today as the start date and today + 120 days as the end date. It has no roster preview or separate launch step.

| Data | Current rollover behavior | Required Season 2 behavior |
| --- | --- | --- |
| Clubs and teams | Copies active, non-deleted teams; reuses `clubId` or creates a club | Keep permanent club identity and create a new Season 2 team entry; review omissions and metadata |
| Players | Copies active, non-deleted players attached to included teams | Keep permanent person identity; returning players start with their existing clubs |
| Inactive/unattached players | Not included by the main rollover | List each excluded player and reason; retain identity and allow later registration |
| Player identity | Reuses `profileId` when present; fallback creates a profile only for the new row | Link both old and new season records to the same profile |
| League rules | Copies rules from the first returned league competition | Explicitly select the source competition and review target rules |
| Cup/other competitions | Not copied | Explicitly include their configuration or show them as excluded; create fresh entries/brackets |
| Goals, assists, appearances, results | Old records stay in Season 1; no target stats are created | Season 2 starts at zero; Season 1 and career views remain available |
| Standings | No zero standing rows are created by rollover | Initialize all Season 2 teams in the table with zero totals |
| Bans and card accumulation | Not copied | Explicit reset policy recorded in rollover; no Season 1 ban affects Season 2 |
| Fixtures and squads | Not copied | Create a new schedule after roster review; no old matchday squads carried forward |
| Awards, votes, polls | Not copied | Preserve Season 1 history; any Season 2 award setup starts without winners, votes, or nominations |
| Staff and team managers | Not copied | Review and copy selected continuing assignments using the new team IDs |
| Sponsors, news, galleries | Existing season/team/player links remain on old records | Preserve history; review sponsor renewals and expose appropriate media through permanent profiles |
| Follows | Remain linked to old team/player IDs | Follow the permanent club/person across seasons, preserving notification preferences |
| User accounts, bookings, venues, payments | Not part of rollover | Remain unchanged; new fixture scheduling must still respect venue availability |

## Findings that must be addressed

1. **Adding an inactive switch alone would damage calculated history.** `recalculatePlayerStats` selects only active players, deletes all calculated player-stat rows for the season, then rebuilds rows for that subset. After deactivation, a later rebuild removes that player's calculated season totals. Raw match events remain, but leaderboards and dependent award calculations can change. It also assigns the rebuilt totals to the player's current team, which can misattribute pre-transfer performance. Fix the historical calculation before exposing inactivity. See `server/src/services/league-system.ts:1198` and `:1300`.

2. **Inactivity exists in storage but is not usable as a player-management feature.** `Player.isActive` exists and the admin listing supports `includeInactive=true`. The editor has no status control or status filter, and `updatePlayer` does not accept `isActive`. Player detail, friendly-stat and some leaderboard queries also filter on current activity. Deactivation would make a historical profile return 404. See `server/src/controllers/admin/players.ts:15`, `:76`, `server/src/controllers/league.ts:279`, and `client/src/pages/admin/AdminPage.tsx:720`.

3. **Permanent identity is only partially maintained.** Ordinary team/player creation does not create or link the corresponding permanent identity and registration records. Updates do not synchronize those records. The rollover fallback creates missing identities but does not write the new `clubId`/`profileId` back to the source records. Existing linked club metadata can also be stale: rollover uses club fields, while normal edits update team fields. The initial identity backfill copies only a subset of profile/club metadata. Resolve these gaps before trusting continuity. See `server/src/controllers/admin/teams.ts:36`, `server/src/controllers/admin/players.ts:49`, `server/src/services/league-system.ts:980`, and the identity backfill in `server/prisma/migrations/20260822120000_add_v2_data_foundation/migration.sql`.

4. **Career pages do not join across permanent identities.** Player detail loads one legacy player row by slug and its relations; it does not combine other season rows with the same `profileId`. A returning player can therefore look like a new player with no previous history on the Season 2 page. Team detail has the same season-record orientation. Slugs are unique only within a season, while detail lookups do not take a season, making reused slugs ambiguous. See `server/src/controllers/league.ts:96` and `:279`, and the `Team`/`Player` schema constraints.

5. **The separate player-copy action is inconsistent and unsafe to repeat.** Its route supplies `:id`, but the handler reads `seasonId`; the target season is therefore not correctly passed to the handler. The implementation matches teams by slug/name, generates new player identities without `profileId`, and has no identity-based duplicate protection. Once the route is fixed, repeating it can create duplicate players. It should use the same reviewed registration service as rollover. See `server/src/routes/admin.ts:158` and `server/src/controllers/admin/players.ts:140`.

6. **Season creation is also publication.** There is no draft lifecycle, source-completion check, roster review, or recorded rollover run. Source data is read before the transaction/lock. The transaction prevents partial writes, but there is no durable retry key that returns the same result after a lost response. The database migration already has a unique current-season index; preserve it and add a controlled switch instead of relying on uniqueness errors. See `server/src/services/league-system.ts:910`, `client/src/pages/admin/AdminPage.tsx:495`, and `seasons_one_current_active_idx` in the foundation migration.

7. **Transfers can move an old player row into a different season.** Updating `teamId` also changes the existing player's `seasonId`. The player update and transfer audit insert are separate writes, and registrations are not updated. Only the transfer-window Boolean is checked, not its expiry date. The UI checks the global current season rather than the edited player's season. Team editing also permits changing `seasonId`. These paths must not be used to move Season 1 records into Season 2. See `server/src/controllers/admin/players.ts:76`, `server/src/controllers/admin/teams.ts:62`, and `client/src/pages/admin/AdminPage.tsx:811`.

8. **Rollover coverage and feedback are incomplete.** There is no staff/manager copy, sponsor renewal review, follow continuity, initial table, or report of omitted players. Promotion/relegation parameters exist on the server but are not exposed in this UI; the outgoing club also needs membership validation. The admin refreshes only seasons after rollover and can leave its selected season and cached player/team views on Season 1. Public standings/stats screens lack a season selector. See `server/src/services/league-system.ts:965`, `client/src/pages/admin/AdminPage.tsx:199`, `:495`, and `client/src/pages/league/StandingsPage.tsx` / `StatsPage.tsx`.

## Implementation order

### 1. Preserve history and complete identity links

- Run a read-only audit on a restored production snapshot: counts by season/team/status; missing profile/club links; duplicate or conflicting identities; player/team season mismatches; overlapping registrations; orphaned dependencies; incomplete fixtures; outstanding bans; pending result projections; and unresolved `IdentityReconciliationIssue` rows.
- Produce explicit mappings from old team IDs to club IDs and old player IDs to profile IDs. Resolve ambiguous people manually; never merge people solely because their names match.
- Backfill missing links and metadata with an auditable, repeatable migration. Keep all existing match/stat/award foreign keys and old links intact. A stable identity does not require rewriting every historical match row.
- Make create/update/registration services maintain permanent identities and season records atomically. Distinguish current profile information from historical season snapshots.
- Rebuild stats from historical participation/events with the team at the time of each match. Include inactive players who participated. Keep league/friendly/competition totals distinct, and preserve supported manual corrections through an explicit policy rather than silently discarding them.
- Prevent reassignment of a historical team or player row to another season. A returning player receives a new season row linked to the existing identity.

Acceptance: deactivation or transfer does not change a completed match's participants, team attribution, goals, appearances, awards, or Season 1 totals after rebuilding.

### 2. Add reversible player inactivity

- Add **Active / Inactive / All** filters, a status badge, and **Mark inactive / Reactivate** actions with reason, effective time, and actor history.
- Scope inactivity to the player's season participation. It must not deactivate the permanent person profile or hide their previous seasons. Keep it separate from a suspension and from delete/recycle-bin actions.
- Add an `INACTIVE` participation status or equivalent dedicated state; do not overload `SUSPENDED`, `RELEASED`, or `EXPIRED`. Update legacy `Player.isActive` and the relevant registrations in one transaction.
- Exclude inactive players from new squad/lineup selection, transfers requiring eligibility, and default rollover selection. Keep them searchable in administration and accessible in historical stats/profile pages.
- Check eligibility on the server across squads, lineups, substitutions, appearances, and live event entry. Historical corrections must use historical eligibility, so present inactivity does not block correcting a past match.
- Detect existing scheduled squad assignments when deactivating: show affected fixtures and require resolving those assignments before match start. Prevent an ordinary deactivation from disrupting a player currently participating in a live match. Never remove completed-match participation.
- Reactivation reuses the same person/season record and does not clear current-season disciplinary restrictions. A player returning after missing a season registers from the existing identity directory.

Acceptance: inactive players cannot newly participate, retain all history, can be found by admins, and can return without duplicate profiles.

### 3. Build a draft rollover workflow

Use the existing transaction and identity tables, extending them rather than creating another independent copy path.

1. Choose source season, target name, actual dates, and source competitions. Create a non-public draft while Season 1 remains current. Add an explicit lifecycle such as `DRAFT`, `ACTIVE`, `COMPLETED`; public endpoints must exclude drafts even when requested by ID.
2. Preview clubs, returning players, inactive exclusions, unattached players, staff, managers, sponsor choices, and rules. Every source player gets an explicit outcome and reason. Default returning players to the same club and record the confirmed ban-reset policy.
3. Store a rollover run with source/target IDs, actor, request key, source revision/fingerprint, options, counts, and old-to-new ID mappings. Enforce unique target registrations and one canonical season player row per person. Define registration constraints to allow valid dated transfers without overlapping team membership in the same competition.
4. Commit the reviewed draft transactionally. Reread/validate the source inside the protected transaction, reject a stale preview, and coordinate concurrent roster edits. Retries return the prior result. Slug collisions and a second rollover from the same source produce clear, recoverable outcomes.
5. Create fresh Season 2 team/player rows, registrations, selected staff assignments, competition entries, and zero standings. Start season statistics and disciplinary accumulation at zero. Do not copy old fixtures, results, votes, winners, matchday squads, or bans.
6. Replace the legacy copy button with this shared service, or remove it once superseded. There must be one consistent path for registering returning players.

Acceptance: generating or retrying a draft never switches the live season, changes source records beyond audited identity repairs, or duplicates players. Omitted people are visible in the report.

### 4. Review rosters, then activate Season 2

- Permit explicit transfers among Season 2 teams using its transfer window and real start/end timestamps. Close the previous registration interval, open the new one, and record the audit in the same transaction. Keep Season 1 membership unchanged.
- Validate team numbers, squad rules, duplicate players, jersey conflicts, registration periods, competition membership, dates, and the fixture plan. Read the selected rules instead of assuming the existing hard-coded 6 starters / 2 substitutes / 4 reserves applies forever.
- Complete or explicitly resolve all Season 1 fixtures and pending result work before final closure. Finalize required awards and retain historical records. Preparing a draft may happen earlier.
- Activate through a dedicated transaction that checks readiness, closes Season 1's transfer window, marks it completed, and switches the current-season pointer under the existing database uniqueness constraint.
- Reset all Season 2 bans and card accumulation by creating no inherited disciplinary rows. Record the season-boundary decision; do not falsify Season 1 bans as served. Historical-season ban queries must never apply to Season 2.
- Add server-side restrictions on completed-season edits with a separate audited correction path. Completion must preserve public access; it must not use soft deletion/recycle-bin archiving.
- Refresh current-season, selected-season, teams, players, fixtures, standings, and leaderboard caches together. Schedule draft operations must target the selected season explicitly.

Acceptance: exactly one season is current; Season 2 is ready for play; Season 1 remains browsable and unchanged.

### 5. Make history continuous for users

- Add season selectors to standings, player lists, leaderboards, team pages, and relevant fixture views. Include season IDs in request/cache keys and use the resolved season consistently in search and pagination.
- Offer permanent club/player pages with season-by-season and career totals; resolve historical slugs through aliases or explicit season context.
- Keep inactive-player history visible with a status label. Separate current squad membership from historical performance.
- Move follows to permanent identities with deduplication and preserved notification preferences. Historical gallery/news/award links remain valid; shared profile views can surface them without duplicating content.
- Review staff, team managers, sponsor renewals, team metadata, and any selected award templates in the draft. Report every optional item that will not carry forward.

## Required verification before launch

Use a restored production snapshot in an isolated environment. Do not run a seed/reset command against production.

| Scenario | Required result |
| --- | --- |
| Normal Season 1 to Season 2 draft | Included clubs/players appear exactly once; permanent identities match; Season 1 remains current |
| Double-click, concurrent requests, retry after timeout | Same committed run/result; no duplicated seasons, registrations, or players |
| Failure halfway through copy | No partial target; source current-season state remains intact |
| Roster changes after preview | Stale preview rejected and refreshed before commit |
| Player inactive after scoring, then stats rebuild | Goals, appearances, historical team attribution and awards remain correct |
| Player reactivated or returning after a skipped season | Same permanent identity, no duplicate season record, bans handled by selected season |
| Transfer after playing for a team | Pre-transfer performance remains with the old team; new performance with the new team |
| Missing identity, duplicate name, renamed team | Explicit mapping/reconciliation; no silent identity merge or name-based misassignment |
| Remaining Season 1 ban | Historical ban retained; Season 2 player eligible under the confirmed reset policy |
| Inactive player in scheduled/live squad | Defined resolution enforced; completed squads and match events unchanged |
| Promoted/relegated club or missing team | Validated membership and explicit player outcomes; no silent omissions |
| Current-season activation | Exactly one current season; draft access controlled; all public/admin views refresh correctly |
| Season 1 readback after Season 2 activity | Fixtures, results, stats, awards, media, profile URLs and season selection still work |
| Staff, sponsors, follows and metadata | Selected continuity is present; exclusions documented |

Add database integration tests for rollover, concurrency, identity, inactivity and transfer behavior; API authorization tests; and focused UI tests for draft review, reactivation and season navigation. Existing checked-in tests cover utility behavior but do not directly cover these rollover/controller paths. Run both workspace type checks and the relevant regression suites after implementation.

Before production activation, take a verified backup, rehearse restoring it, and record baseline totals and source-to-target counts. Compare historical results and stats after the rehearsal, accounting only for explicitly reviewed pre-existing calculation corrections. Resolve every unexplained difference.

Rollback should initially mean abandoning an unpublished draft. After publication, a controlled current-season reversal is only appropriate if no Season 2 matches or dependent activity have started. Once new activity exists, use audited corrections and a reviewed recovery plan; a full database restore could erase unrelated bookings or payments and is not a routine season undo.

## Release recommendation

Complete and verify the history/identity work first, then inactivity, then the draft rollover and launch workflow, with continuous public profiles and season navigation ready before activation. Until those checks pass, the existing **Create Next Season** and separate **Copy players** actions should not be used for the live Season 2 transition.
