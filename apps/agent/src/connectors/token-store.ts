import "server-only";
import { prisma } from "@/lib/db";

/**
 * TokenStore abstraction
 * ----------------------
 * All OAuth token persistence goes through this interface. The MVP stores
 * tokens in plaintext columns on `oauth_accounts`; because every read/write is
 * funneled here, a future phase can swap in an encrypted implementation
 * (e.g. KMS envelope encryption or a secrets manager) without changing any
 * caller. See README "Security considerations" for the Phase 2 plan.
 */
export interface StoredToken {
  accessToken: string | null;
  refreshToken: string | null;
  /** Expiry as epoch seconds. */
  expiresAt: number | null;
  tokenType: string | null;
  scope: string | null;
  providerAccountId: string;
}

export interface TokenStore {
  get(userId: string, provider: string): Promise<StoredToken | null>;
  save(
    userId: string,
    provider: string,
    token: StoredToken,
  ): Promise<void>;
}

class PrismaTokenStore implements TokenStore {
  async get(userId: string, provider: string): Promise<StoredToken | null> {
    const row = await prisma.oAuthAccount.findUnique({
      where: { userId_provider: { userId, provider } },
    });
    if (!row) return null;
    return {
      accessToken: row.accessToken,
      refreshToken: row.refreshToken,
      expiresAt: row.expiresAt,
      tokenType: row.tokenType,
      scope: row.scope,
      providerAccountId: row.providerAccountId,
    };
  }

  async save(
    userId: string,
    provider: string,
    token: StoredToken,
  ): Promise<void> {
    await prisma.oAuthAccount.upsert({
      where: { userId_provider: { userId, provider } },
      create: {
        userId,
        provider,
        providerAccountId: token.providerAccountId,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        expiresAt: token.expiresAt,
        tokenType: token.tokenType,
        scope: token.scope,
      },
      update: {
        providerAccountId: token.providerAccountId,
        accessToken: token.accessToken,
        // Google omits refresh_token on subsequent consents; keep the old one.
        ...(token.refreshToken ? { refreshToken: token.refreshToken } : {}),
        expiresAt: token.expiresAt,
        tokenType: token.tokenType,
        scope: token.scope,
      },
    });
  }
}

export const tokenStore: TokenStore = new PrismaTokenStore();
