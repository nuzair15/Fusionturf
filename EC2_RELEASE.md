# EC2 release commands

These commands are for an **existing** deployment using this repository's `docker-compose.prod.yml` on one EC2 host. They preserve the existing `.env` and PostgreSQL volume. They do not create or activate Season 2; that is a separate reviewed admin action.

Connect to the EC2 host by SSH, go to the repository directory, and run this block in Bash. Replace only the directory on the first line. `set -e` stops the sequence if any command fails.

```bash
set -euo pipefail
cd /path/to/Fusionturf
git status --short
git pull --ff-only origin main
git rev-parse --short HEAD
test -f .env
docker compose -f docker-compose.prod.yml --env-file .env config --quiet
docker compose -f docker-compose.prod.yml --env-file .env ps
docker compose -f docker-compose.prod.yml --env-file .env up -d postgres
mkdir -p ../fusion-league-backups
SEASON_BACKUP="../fusion-league-backups/fusion_league_$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$SEASON_BACKUP"
test -s "$SEASON_BACKUP"
docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres pg_restore -l < "$SEASON_BACKUP" > /dev/null
printf 'Backup saved: %s\n' "$SEASON_BACKUP"
docker compose -f docker-compose.prod.yml --env-file .env build api-migrate
docker compose -f docker-compose.prod.yml --env-file .env run --rm api-migrate
docker compose -f docker-compose.prod.yml --env-file .env build api
docker compose -f docker-compose.prod.yml --env-file .env build client
docker compose -f docker-compose.prod.yml --env-file .env up -d --no-build api client
docker compose -f docker-compose.prod.yml --env-file .env ps
docker compose -f docker-compose.prod.yml --env-file .env logs --tail=80 api client
```

The Compose migration service deliberately builds from the `build` Docker stage, which retains the Prisma CLI. The running API image is pruned. Do not use the development `docker-compose.yml` on EC2. Do not run a seed or database reset command on live data.

Confirm that the existing `.env` sets the right `CORS_ORIGIN`, `FRONTEND_URL`, and `VITE_API_URL` for your public domain. `VITE_API_URL` is baked into the client image at build time, so rebuild the client if it changes. The `CLOUDINARY_*` settings must be present in `.env` for team-banner uploads. The Compose file exposes the API on port 5000 and the frontend on port 80; existing reverse proxy or TLS settings must continue to point to those services.

Check the public endpoints from the EC2 host after deployment:

```bash
curl -f http://localhost/api/league/seasons/index.html -o /dev/null
curl -f http://localhost/llms.txt
curl -f http://localhost:5000/api/league/seasons -o /dev/null
```

The database backup is a recovery artifact, not a routine rollback command: restoring it later would also roll back bookings and payments made since the backup. Resolve any migration or deployment failure before creating a Season 2 draft. For real-data identity checks and the activation process, follow [SEASON_2_RELEASE.md](SEASON_2_RELEASE.md).
