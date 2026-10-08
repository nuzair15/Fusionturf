import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Response } from "express";
import type { OAuthServerProvider, AuthorizationParams } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthClientInformationFull, OAuthTokenRevocationRequest, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import { InvalidClientMetadataError, InvalidGrantError, InvalidScopeError, InvalidTargetError, InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import prisma from "../../config/database.js";
import { config } from "../../config/index.js";

export const BOOKING_ROLES = ["SUPER_ADMIN", "BOOKING_MANAGER", "BOOKING_ADMIN"];
export const SCOPES = ["bookings:read", "bookings:write"];
export const integrationBase = "/api/integrations/bookings";
export const publicOrigin = new URL(config.bookingsMcp.publicUrl).origin;
export const resourceUrl = `${publicOrigin}${integrationBase}/mcp`;
export const issuerUrl = publicOrigin;
export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const secret = () => randomBytes(32).toString("base64url");

export function allowedRedirect(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.hash) return false;
    if (url.origin === "https://chatgpt.com") return url.pathname === "/connector_platform_oauth_redirect" || /^\/connector\/oauth\/[a-zA-Z0-9_-]+$/.test(url.pathname);
    return config.nodeEnv !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  } catch { return false; }
}

async function staff(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, isActive: true } });
  if (!user?.isActive || !BOOKING_ROLES.includes(user.role)) throw new InvalidTokenError("Booking staff access has been revoked");
  return user;
}

export class BookingOAuthProvider implements OAuthServerProvider {
  clientsStore = {
    getClient: async (id: string): Promise<OAuthClientInformationFull | undefined> => {
      const row = await prisma.mcpClient.findUnique({ where: { id } });
      return row ? row.metadata as unknown as OAuthClientInformationFull : undefined;
    },
    registerClient: async (client: Omit<OAuthClientInformationFull, "client_id" | "client_id_issued_at">): Promise<OAuthClientInformationFull> => {
      if (client.token_endpoint_auth_method !== "none") throw new InvalidClientMetadataError("Use a public OAuth client with PKCE (authentication method: none)");
      if (!client.redirect_uris.length || client.redirect_uris.length > 5 || !client.redirect_uris.every(allowedRedirect)) throw new InvalidClientMetadataError("Only ChatGPT callback URLs are allowed");
      const metadata: OAuthClientInformationFull = { ...client, client_name: (client.client_name || "ChatGPT").slice(0, 120), client_id: randomUUID(), client_id_issued_at: Math.floor(Date.now() / 1000), token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] };
      delete metadata.client_secret;
      await prisma.mcpClient.create({ data: { id: metadata.client_id, metadata: JSON.parse(JSON.stringify(metadata)) } });
      return metadata;
    },
  };

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response) {
    if (params.resource?.href !== resourceUrl) throw new InvalidTargetError("The resource must be the Fusion Bookings MCP URL");
    const scopes = params.scopes?.length ? params.scopes : ["bookings:read"];
    if (scopes.some(scope => !SCOPES.includes(scope))) throw new InvalidScopeError("Unsupported booking scope");
    if (!/^[A-Za-z0-9_-]{43}$/.test(params.codeChallenge)) throw new InvalidGrantError("Invalid PKCE S256 challenge");
    const request = await prisma.mcpGrant.create({ data: { clientId: client.client_id, redirectUri: params.redirectUri, state: params.state, codeChallenge: params.codeChallenge, resource: resourceUrl, scopes, expiresAt: new Date(Date.now() + 10 * 60_000) } });
    const target = new URL("/connect/chatgpt", config.frontendUrl);
    target.searchParams.set("request", request.id);
    res.redirect(target.href);
  }

  async challengeForAuthorizationCode(client: OAuthClientInformationFull, code: string) {
    const grant = await prisma.mcpGrant.findUnique({ where: { codeHash: hash(code) } });
    if (!grant || grant.clientId !== client.client_id || grant.consumedAt || grant.expiresAt <= new Date() || !grant.userId) throw new InvalidGrantError("Authorization code is invalid or expired");
    return grant.codeChallenge;
  }

  async exchangeAuthorizationCode(client: OAuthClientInformationFull, code: string, _verifier?: string, redirectUri?: string, resource?: URL): Promise<OAuthTokens> {
    return prisma.$transaction(async tx => {
      const grant = await tx.mcpGrant.findUnique({ where: { codeHash: hash(code) } });
      if (!grant?.userId || grant.clientId !== client.client_id || grant.redirectUri !== redirectUri || grant.resource !== resource?.href || grant.consumedAt || grant.expiresAt <= new Date()) throw new InvalidGrantError("Authorization code is invalid or expired");
      await staff(grant.userId);
      const claimed = await tx.mcpGrant.updateMany({ where: { id: grant.id, consumedAt: null }, data: { consumedAt: new Date() } });
      if (claimed.count !== 1) throw new InvalidGrantError("Authorization code was already used");
      const access = secret(), refresh = secret();
      await tx.mcpConnection.create({ data: { clientId: client.client_id, userId: grant.userId, accessHash: hash(access), refreshHash: hash(refresh), resource: grant.resource, scopes: grant.scopes, accessExpiresAt: new Date(Date.now() + 60 * 60_000), refreshExpiresAt: new Date(Date.now() + 30 * 86400_000) } });
      return { access_token: access, refresh_token: refresh, token_type: "Bearer", expires_in: 3600, scope: grant.scopes.join(" ") };
    });
  }

  async exchangeRefreshToken(client: OAuthClientInformationFull, token: string, scopes?: string[], resource?: URL): Promise<OAuthTokens> {
    const row = await prisma.mcpConnection.findUnique({ where: { refreshHash: hash(token) } });
    if (!row || row.clientId !== client.client_id || row.revokedAt || row.refreshExpiresAt <= new Date() || row.resource !== resource?.href) throw new InvalidGrantError("Refresh token is invalid or expired");
    await staff(row.userId);
    const nextScopes = scopes || row.scopes;
    if (nextScopes.some(scope => !row.scopes.includes(scope))) throw new InvalidScopeError("Refresh cannot grant extra permissions");
    const access = secret(), refresh = secret();
    const claimed = await prisma.mcpConnection.updateMany({ where: { id: row.id, refreshHash: hash(token), revokedAt: null }, data: { accessHash: hash(access), refreshHash: hash(refresh), scopes: nextScopes, accessExpiresAt: new Date(Date.now() + 60 * 60_000) } });
    if (claimed.count !== 1) throw new InvalidGrantError("Refresh token was already used");
    return { access_token: access, refresh_token: refresh, token_type: "Bearer", expires_in: 3600, scope: nextScopes.join(" ") };
  }

  async verifyAccessToken(token: string) {
    const row = await prisma.mcpConnection.findUnique({ where: { accessHash: hash(token) } });
    if (!row || row.revokedAt || row.accessExpiresAt <= new Date() || row.resource !== resourceUrl) throw new InvalidTokenError("Please reconnect Fusion Bookings");
    const user = await staff(row.userId);
    return { token, clientId: row.clientId, scopes: row.scopes, expiresAt: Math.floor(row.accessExpiresAt.getTime() / 1000), resource: new URL(row.resource), extra: { userId: user.id, role: user.role, connectionId: row.id } };
  }

  async revokeToken(client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest) {
    await prisma.mcpConnection.updateMany({ where: { clientId: client.client_id, OR: [{ accessHash: hash(request.token) }, { refreshHash: hash(request.token) }] }, data: { revokedAt: new Date() } });
  }
}

export const oauthProvider = new BookingOAuthProvider();
