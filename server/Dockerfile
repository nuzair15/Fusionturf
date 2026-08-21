FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma

RUN npx prisma generate
RUN npm run build

# devDependencies (typescript, prisma CLI, tsx, vitest, @types/*, ...) are
# only needed to produce dist/ above -- they're dead weight in the running
# container. Pruning them here, before the copy into the runner stage,
# keeps the final image (and everything the container has to read off disk
# on cold start) to just what's actually required at runtime.
RUN npm prune --omit=dev

FROM node:20-alpine AS runner

ENV NODE_ENV=production
# Caps the V8 heap well under what a small instance (e.g. a 1GB t3/t4g
# .micro) has available, so Node's GC reclaims memory proactively instead
# of growing the heap toward whatever the machine happens to have -- which
# is what invites the OOM killer on a tiny box. Override with a different
# NODE_OPTIONS value at `docker run`/compose time if you deploy to
# something bigger.
ENV NODE_OPTIONS="--max-old-space-size=192"

WORKDIR /app

# Run as an unprivileged user rather than root inside the container.
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

USER nodejs

EXPOSE 5000

CMD ["node", "dist/production.js"]
