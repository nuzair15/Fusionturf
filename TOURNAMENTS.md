# Independent tournaments

Tournament data lives in separate `tournament_*` tables. Tournament teams, players, fixtures, lineups, events, scores and standings do not feed Fusion League seasons or statistics.

## Admin workflow

1. Open **Admin → Tournaments → New tournament**. Choose round robin, single elimination, double elimination or groups plus knockout. Set the tournament logo, Riyadh kickoff time, match spacing, players on the field, minutes per half and halftime break.
2. Add tournament teams and players. Logos and photos can be uploaded or entered as image URLs. For a group tournament, assign every team to a group or leave every group empty for automatic assignment.
3. Generate opening fixtures, or add fixtures manually. Scheduled fixtures can be edited or deleted. The next knockout round becomes available after all current fixtures finish.
4. Set exactly the configured number of starters for both teams. Add substitutes as needed. Publish the tournament before starting a match.
5. Open **Live control** on a fixture. It uses the regular match control center for clock states, goals, cards, statistics, corrections and a penalty shootout when a knockout match is tied. The configured half length appears above the controls.
6. Generate subsequent knockout rounds after the results are complete. Double elimination schedules a final reset if the previously unbeaten finalist loses. Complete the tournament after the final champion is decided.

The public **Tournaments** tab shows published and active tournaments, their teams, standings where applicable, fixtures, lineups and match timelines. Active tournaments also appear on user and admin dashboards.

## Deployment

Apply the new migration before running the updated server:

```sh
npm run db:migrate
npm run db:generate
```

The migration was validated against an isolated PostgreSQL database. It has not been applied to the production database.
