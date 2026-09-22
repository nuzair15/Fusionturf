# EC2 release commands for the existing PM2 deployment

The live site runs under PM2. Use these commands on that EC2 host, as the same Unix user that owns the existing PM2 processes. Do not start the repository's Docker Compose stack. These steps update the code, apply the additive season migration, and restart the existing processes. Creating and activating Season 2 remains a separate admin action.

First inspect the process names and frontend route. The repository does not contain the EC2 PM2 ecosystem file or the host's Nginx configuration, so those names and paths must come from the host:

```bash
cd /path/to/Fusionturf
pm2 list
pm2 describe YOUR_API_PROCESS_NAME
sudo nginx -T 2>/dev/null | grep -E 'server_name|root |proxy_pass' | head -80
```

The API process should run this repository's `server/dist/production.js` from the `server` directory. If `pm2 describe` points to a different checkout, use that checkout instead. Identify whether Nginx serves `client/dist` directly, copies it to another document root, or proxies to a frontend PM2 process. The commands below build both application parts but only restart the named API process.

With the correct checkout and PM2 API name, run this block. Replace `YOUR_API_PROCESS_NAME` and the checkout path. The database connection must be available either as `server/.env` or as `DATABASE_URL` in this shell, and it must be the same production database used by PM2.

```bash
set -euo pipefail
umask 077
cd /path/to/Fusionturf
git status --short
git pull --ff-only origin main
git rev-parse --short HEAD
test -f server/.env || test -n "${DATABASE_URL:-}"
command -v pg_dump
command -v pg_restore

npm ci --include=dev --prefix server
npm run db:generate --prefix server
npm run build:server
npm ci --include=dev --prefix client
npm run build:client
( cd server && node -r dotenv/config -e 'const u = new URL(process.env.DATABASE_URL); console.log(`Database target: ${u.hostname}:${u.port || "5432"}${u.pathname}`)' )

mkdir -p ../fusion-league-backups
SEASON_BACKUP="$(pwd)/../fusion-league-backups/fusion_league_$(date -u +%Y%m%dT%H%M%SZ).dump"
( cd server && node scripts/backup-database.mjs "$SEASON_BACKUP" )
pg_restore --list "$SEASON_BACKUP" > /dev/null
```

Read the `Database target` line and confirm it names the production database used by PM2. Confirm the backup path exists and is nonempty. Then apply the migration and restart the existing API process:

```bash
npm run db:migrate --prefix server
pm2 restart YOUR_API_PROCESS_NAME --update-env
pm2 describe YOUR_API_PROCESS_NAME
pm2 logs YOUR_API_PROCESS_NAME --lines 80 --nostream
```

The backup helper reads `DATABASE_URL` without printing it or passing its password as a `pg_dump` command argument. The `pg_dump` client must be compatible with the PostgreSQL server version; if the backup or its `pg_restore --list` check fails, the migration does not run because of `set -e`. `prisma migrate deploy` applies pending migrations and does not seed or reset data. [Prisma's migration documentation](https://docs.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate) describes this production command; [PM2's CLI reference](https://pm2.io/docs/runtime/reference/pm2-cli/) documents `restart --update-env`.

Publish the built frontend using the path you found above:

- If Nginx's `root` already points at this checkout's `client/dist`, the new files are served automatically. Test Nginx with `sudo nginx -t`.
- If Nginx's document root is a different directory, set `WEB_ROOT` to that exact existing root, then run `sudo rsync -a client/dist/ "$WEB_ROOT"/`, `sudo nginx -t`, and `sudo systemctl reload nginx`. This copies the new build without deleting other files in that directory.
- If Nginx proxies the frontend to a separate PM2 process, run `pm2 restart YOUR_FRONTEND_PROCESS_NAME --update-env` and inspect its PM2 logs. Do not use this frontend command for a static Nginx site.

`VITE_API_URL` is baked into the frontend build. Preserve the production value already supplied by the EC2 environment or `client/.env.production`, and confirm it points to the existing API route. Preserve `CORS_ORIGIN`, `FRONTEND_URL`, and `CLOUDINARY_*` in the API's environment; the new team-banner upload uses the existing Cloudinary integration. Check the public site and API after the frontend is published:

```bash
curl -f https://www.fusionturf.in/llms.txt
curl -f https://www.fusionturf.in/api/league/seasons/index.html -o /dev/null
```

If Nginx sends `/api` to a separate hostname, test that hostname's `/api/league/seasons/index.html` instead. A successful `pg_restore --list` verifies that the dump is readable; rehearse a real restore in staging before relying on it as a recovery plan. Do not restore this dump over an active production database after new bookings or payments have occurred.
