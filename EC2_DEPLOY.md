# Fusion Turf deployment notes

## Repository details

- Git remote: `https://github.com/nuzair15/Fusionturf.git`
- Main branch: `main`
- Local checkout: `C:\Users\GIGABYTE\Downloads\league\fusion-league`
- EC2 user: `ubuntu`
- EC2 repository: `/opt/fusionturf`
- EC2 server directory: `/opt/fusionturf/server`
- Recommended PM2 API name: `fusion-api`

The hostname `ip-172-31-41-136` is private to EC2. Use the instance public IP or DNS for SSH from outside the VPC.

## Local PowerShell workflow

```powershell
cd C:\Users\GIGABYTE\Downloads\league\fusion-league
git status
git pull --ff-only origin main
cd client
npm run typecheck
npm run build
cd ..\server
npm run typecheck
npm run build
```

Commit and push:

```powershell
cd C:\Users\GIGABYTE\Downloads\league\fusion-league
git add -A
git diff --cached --check
git commit -m "Describe the change"
git push origin main
```

## First-time EC2 setup

```bash
ssh -i /path/to/key.pem ubuntu@YOUR_EC2_PUBLIC_IP
cd /opt/fusionturf
git pull --ff-only origin main
cd server
npm ci --include=dev
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 start dist/production.js --name fusion-api --cwd /opt/fusionturf/server --update-env
pm2 save
pm2 startup
```

Run the command printed by `pm2 startup` with `sudo`, then run `pm2 save` again.

## Normal EC2 deployment

```bash
cd /opt/fusionturf
git restore -- client/tsconfig.tsbuildinfo 2>/dev/null || true
git pull --ff-only origin main
cd server
npm ci --include=dev
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 reload fusion-api --update-env
pm2 save
```

If the process does not exist:

```bash
pm2 start dist/production.js --name fusion-api --cwd /opt/fusionturf/server --update-env
pm2 save
```

## Frontend

```bash
cd /opt/fusionturf/client
npm ci
npm run build
```

For Nginx, replace the destination with the configured web root:

```bash
sudo rsync -a --delete dist/ /var/www/fusionturf/
sudo systemctl reload nginx
```

For PM2 static hosting instead:

```bash
pm2 delete fusion-client 2>/dev/null || true
pm2 serve dist 4173 --name fusion-client --spa
pm2 save
```

## Troubleshooting

```bash
pm2 list
pm2 describe fusion-api
pm2 logs fusion-api --lines 100
cd /opt/fusionturf/server
test -f .env && echo ".env exists" || echo "ERROR: server/.env is missing"
```

Never commit `server/.env`, database passwords, JWT secrets, or Cloudinary secrets.
