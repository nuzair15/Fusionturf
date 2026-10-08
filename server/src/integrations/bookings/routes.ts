import { Router, type Request, type Response, type NextFunction } from "express";
import { randomBytes } from "node:crypto";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { authorizationHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/authorize.js";
import { clientRegistrationHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/register.js";
import { tokenHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/token.js";
import { revocationHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/revoke.js";
import { mcpAuthMetadataRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { config } from "../../config/index.js";
import prisma from "../../config/database.js";
import { authenticate, authorize } from "../../middleware/auth.js";
import { AppError } from "../../middleware/errorHandler.js";
import { BOOKING_ROLES, SCOPES, hash, integrationBase, issuerUrl, oauthProvider, publicOrigin, resourceUrl } from "./auth.js";
import { createBookingMcpServer } from "./tools.js";
import { readBookingFile } from "./files.js";

const router = Router();
const endpoint = (path: string) => `${publicOrigin}${integrationBase}/${path}`;
export const oauthMetadata = {
  issuer: issuerUrl,
  authorization_endpoint: endpoint("oauth/authorize"),
  token_endpoint: endpoint("oauth/token"),
  registration_endpoint: endpoint("oauth/register"),
  revocation_endpoint: endpoint("oauth/revoke"),
  response_types_supported: ["code"],
  grant_types_supported: ["authorization_code", "refresh_token"],
  token_endpoint_auth_methods_supported: ["none"],
  code_challenge_methods_supported: ["S256"],
  scopes_supported: SCOPES,
};
const resourceMetadata = { resource: resourceUrl, authorization_servers: [issuerUrl], scopes_supported: SCOPES, resource_name: "Fusion Bookings" };
const asyncRoute = (run: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => { run(req, res).catch(next); };

router.get(`${integrationBase}/status`, (_req, res) => res.json({ enabled: config.bookingsMcp.enabled, name: "Fusion Bookings", mcpUrl: resourceUrl, authentication: "OAuth 2.1 with PKCE", openaiApiKeyRequired: false }));

if (config.bookingsMcp.enabled) {
  if (config.nodeEnv === "production" && (!publicOrigin.startsWith("https:") || !config.frontendUrl.startsWith("https:"))) throw new Error("BOOKINGS_MCP_PUBLIC_URL and FRONTEND_URL must use HTTPS in production");
  router.use(mcpAuthMetadataRouter({ oauthMetadata, resourceServerUrl: new URL(resourceUrl), scopesSupported: SCOPES, resourceName: "Fusion Bookings" }));
  router.get(`${integrationBase}/oauth-metadata`, (_req, res) => res.json(oauthMetadata));
  router.get(`${integrationBase}/resource-metadata`, (_req, res) => res.json(resourceMetadata));
  router.use(`${integrationBase}/oauth/authorize`, authorizationHandler({ provider: oauthProvider }));
  router.use(`${integrationBase}/oauth/register`, clientRegistrationHandler({ clientsStore: oauthProvider.clientsStore }));
  router.use(`${integrationBase}/oauth/token`, tokenHandler({ provider: oauthProvider }));
  router.use(`${integrationBase}/oauth/revoke`, revocationHandler({ provider: oauthProvider }));
  router.get(`${integrationBase}/files/:id/:fileName`, rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false }), asyncRoute(async (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    const file = await readBookingFile(req.params.id, req.params.fileName, token);
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Disposition", `${file.mimeType === "image/png" ? "inline" : "attachment"}; filename="${file.fileName}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    // ChatGPT's isolated viewer has a different origin; signed capabilities and
    // current staff permissions still control every file request.
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.send(file.bytes);
  }));

  const staff = [authenticate, authorize(...BOOKING_ROLES)];
  router.get(`${integrationBase}/requests/:id`, ...staff, asyncRoute(async (req, res) => {
    const grant = await prisma.mcpGrant.findFirst({ where: { id: req.params.id, consumedAt: null, codeHash: null, expiresAt: { gt: new Date() } } });
    if (!grant) throw new AppError("This connection request expired. Start connecting again in ChatGPT.", 404);
    const client = await oauthProvider.clientsStore.getClient(grant.clientId);
    res.setHeader("Cache-Control", "no-store");
    res.json({ clientName: client?.client_name || "ChatGPT", scopes: grant.scopes, expiresAt: grant.expiresAt });
  }));
  router.post(`${integrationBase}/requests/:id/consent`, ...staff, asyncRoute(async (req, res) => {
    const { approve } = z.object({ approve: z.boolean() }).parse(req.body);
    const grant = await prisma.mcpGrant.findFirst({ where: { id: req.params.id, consumedAt: null, codeHash: null, expiresAt: { gt: new Date() } } });
    if (!grant) throw new AppError("This connection request expired or was already handled.", 409);
    const code = randomBytes(32).toString("base64url");
    const changed = await prisma.mcpGrant.updateMany({ where: { id: grant.id, consumedAt: null, codeHash: null }, data: approve ? { userId: req.user!.userId, codeHash: hash(code), expiresAt: new Date(Date.now() + 5 * 60_000) } : { consumedAt: new Date() } });
    if (changed.count !== 1) throw new AppError("This request was already handled.", 409);
    const redirect = new URL(grant.redirectUri);
    if (grant.state !== null) redirect.searchParams.set("state", grant.state);
    if (approve) redirect.searchParams.set("code", code);
    else redirect.searchParams.set("error", "access_denied");
    await prisma.activityLog.create({ data: { userId: req.user!.userId, action: approve ? "MCP_CONNECT_APPROVED" : "MCP_CONNECT_DENIED", entity: "MCP_CONNECTION", metadata: { clientId: grant.clientId, scopes: grant.scopes } } });
    res.setHeader("Cache-Control", "no-store");
    res.json({ redirectUrl: redirect.href });
  }));
  router.get(`${integrationBase}/connections`, ...staff, asyncRoute(async (req, res) => {
    const connections = await prisma.mcpConnection.findMany({ where: { userId: req.user!.userId, revokedAt: null, refreshExpiresAt: { gt: new Date() } }, select: { id: true, clientId: true, scopes: true, createdAt: true, refreshExpiresAt: true }, orderBy: { createdAt: "desc" } });
    const result = await Promise.all(connections.map(async connection => ({ ...connection, clientName: (await oauthProvider.clientsStore.getClient(connection.clientId))?.client_name || "ChatGPT" })));
    res.setHeader("Cache-Control", "no-store");
    res.json({ connections: result });
  }));
  router.post(`${integrationBase}/connections/:id/revoke`, ...staff, asyncRoute(async (req, res) => {
    const changed = await prisma.mcpConnection.updateMany({ where: { id: req.params.id, userId: req.user!.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    if (!changed.count) throw new AppError("Connection not found", 404);
    await prisma.activityLog.create({ data: { userId: req.user!.userId, action: "MCP_CONNECTION_REVOKED", entity: "MCP_CONNECTION", entityId: req.params.id } });
    res.json({ revoked: true });
  }));

  router.use(`${integrationBase}/mcp`, rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false }));
  router.post(`${integrationBase}/mcp`, asyncRoute(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const token = req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
    if (token) {
      try { await oauthProvider.verifyAccessToken(token); }
      catch {
        res.setHeader("WWW-Authenticate", `Bearer resource_metadata="${endpoint("resource-metadata")}"`);
        res.status(401).json({ error: "invalid_token" });
        return;
      }
    }
    const server = createBookingMcpServer(token);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true, enableDnsRebindingProtection: true, allowedHosts: [new URL(publicOrigin).host, "localhost:*", "127.0.0.1:*"], allowedOrigins: [publicOrigin, new URL(config.frontendUrl).origin, "https://chatgpt.com"] });
    res.on("close", () => { void transport.close(); void server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }));
  router.all(`${integrationBase}/mcp`, (_req, res) => { res.setHeader("Allow", "POST"); res.status(405).json({ error: "Use MCP Streamable HTTP POST requests" }); });
}

export default router;
