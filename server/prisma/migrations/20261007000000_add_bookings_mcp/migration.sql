CREATE TABLE "mcp_clients" (
  "id" TEXT PRIMARY KEY, "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "mcp_grants" (
  "id" TEXT PRIMARY KEY, "clientId" TEXT NOT NULL, "redirectUri" TEXT NOT NULL,
  "state" TEXT, "codeChallenge" TEXT NOT NULL, "resource" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL, "userId" TEXT, "codeHash" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL, "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mcp_grants_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "mcp_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "mcp_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "mcp_grants_codeHash_key" ON "mcp_grants"("codeHash");
CREATE INDEX "mcp_grants_expiresAt_idx" ON "mcp_grants"("expiresAt");
CREATE TABLE "mcp_connections" (
  "id" TEXT PRIMARY KEY, "clientId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "accessHash" TEXT NOT NULL, "refreshHash" TEXT NOT NULL, "resource" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL, "accessExpiresAt" TIMESTAMP(3) NOT NULL,
  "refreshExpiresAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mcp_connections_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "mcp_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "mcp_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "mcp_connections_accessHash_key" ON "mcp_connections"("accessHash");
CREATE UNIQUE INDEX "mcp_connections_refreshHash_key" ON "mcp_connections"("refreshHash");
CREATE INDEX "mcp_connections_userId_revokedAt_idx" ON "mcp_connections"("userId", "revokedAt");
CREATE TABLE "mcp_operations" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "tool" TEXT NOT NULL,
  "inputHash" TEXT NOT NULL, "state" TEXT NOT NULL DEFAULT 'PENDING', "result" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mcp_operations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
