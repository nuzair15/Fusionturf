# EC2 release commands for the existing PM2 deployment

The live site runs under PM2. The API process is `fusionturf-api`; Nginx serves `/opt/fusionturf/client/dist` and proxies the API to port 5000. Use these commands on that EC2 host as `ubuntu`, which owns the PM2 process. Do not start the repository's Docker Compose stack. These steps update the code, apply the additive season migration, and restart the existing API process. Creating and activating Season 2 remains a separate admin action.

First confirm that PM2 still points to this checkout:

```bash
cd /opt/fusionturf
pm2 list
pm2 describe fusionturf-api
sudo nginx -T 2>/dev/null | grep -E 'server_name|root |proxy_pass' | head -80
```

The API process should run this repository's server build from the `server` directory. If `pm2 describe` points to a different checkout, stop and use that checkout instead. Nginx already serves the built frontend directly; it needs no frontend PM2 process or file copy.

When the checkout matches, run this block. The database connection must be available either as `server/.env` or as `DATABASE_URL` in this shell, and it must be the same production database used by PM2.

```bash
set -euo pipefail
umask 077
cd /opt/fusionturf
git status --short
git pull --ff-only origin main
git rev-parse --short HEAD
test -f server/.env || test -n "${DATABASE_URL:-}"
command -v pg_dump
command -v pg_restore
command -v rsync

npm ci --include=dev --prefix server
npm run db:generate --prefix server
npm run build:server
npm ci --include=dev --prefix client
( cd server && node -r dotenv/config -e 'const u = new URL(process.env.DATABASE_URL); console.log(`Database target: ${u.hostname}:${u.port || "5432"}${u.pathname}`)' )

mkdir -p ../fusion-league-backups
SEASON_BACKUP="$(pwd)/../fusion-league-backups/fusion_league_$(date -u +%Y%m%dT%H%M%SZ).dump"
( cd server && node scripts/backup-database.mjs "$SEASON_BACKUP" )
pg_restore --list "$SEASON_BACKUP" > /dev/null
```

Read the `Database target` line and confirm it names the production database used by PM2. Confirm the backup path exists and is nonempty. Then apply the migration and restart the existing API process:

```bash
npm run db:migrate --prefix server
pm2 restart fusionturf-api --update-env
pm2 describe fusionturf-api
pm2 logs fusionturf-api --lines 80 --nostream

FRONTEND_STAGE="$(pwd)/../fusion-league-builds/client-$(git rev-parse --short HEAD)-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$(dirname "$FRONTEND_STAGE")"
npm run build --prefix client -- --outDir "$FRONTEND_STAGE"
rsync -a --exclude=index.html "$FRONTEND_STAGE"/ client/dist/
cp "$FRONTEND_STAGE/index.html" client/dist/index.html.new
mv -f client/dist/index.html.new client/dist/index.html
```

The backup helper reads `DATABASE_URL` without printing it or passing its password as a `pg_dump` command argument. The `pg_dump` client must be compatible with the PostgreSQL server version; if the backup or its `pg_restore --list` check fails, the migration does not run because of `set -e`. `prisma migrate deploy` applies pending migrations and does not seed or reset data. [Prisma's migration documentation](https://docs.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate) describes this production command; [PM2's CLI reference](https://pm2.io/docs/runtime/reference/pm2-cli/) documents `restart --update-env`.

The frontend is built outside Nginx's live `/opt/fusionturf/client/dist` root. Its assets are copied first, then `index.html` is replaced by a single rename so the live site is not cleared during the build. No Nginx reload or frontend PM2 restart is needed. Check the configuration and public routes after publication:

`VITE_API_URL` is baked into the frontend build. Preserve the production value already supplied by the EC2 environment or `client/.env.production`, and confirm it points to the existing API route. Preserve `CORS_ORIGIN`, `FRONTEND_URL`, and `CLOUDINARY_*` in the API's environment; the new team-banner upload uses the existing Cloudinary integration. Check the public site and API after the frontend is published:

```bash
sudo nginx -t
curl -f https://www.fusionturf.in/llms.txt
curl -f https://www.fusionturf.in/api/league/seasons/index.html -o /dev/null
```

A successful `pg_restore --list` verifies that the dump is readable; rehearse a real restore in staging before relying on it as a recovery plan. Do not restore this dump over an active production database after new bookings or payments have occurred.
