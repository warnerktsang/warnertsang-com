import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { Profile } from "next-auth";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { tokenStore } from "@/connectors/token-store";
import {
  CALENDAR_READONLY_SCOPE,
  GMAIL_READONLY_SCOPE,
  GOOGLE_PROVIDER,
} from "@/connectors/google/client";

const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  CALENDAR_READONLY_SCOPE,
  GMAIL_READONLY_SCOPE,
].join(" ");

function isAllowedEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.toLowerCase() === env.ALLOWED_GOOGLE_EMAIL.toLowerCase();
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: GOOGLE_SCOPES,
          access_type: "offline",
          // Force consent so Google returns a refresh_token on every re-link.
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    /**
     * Server-side allowlist enforcement. Only ALLOWED_GOOGLE_EMAIL may sign in;
     * every other authenticated account is rejected (fail closed).
     */
    async signIn({ user }) {
      if (isAllowedEmail(user?.email)) return true;
      await recordAudit({
        type: "login_denied",
        action: `Denied sign-in for ${user?.email ?? "unknown"}`,
        success: false,
        metadata: { email: user?.email ?? null },
      });
      return false;
    },

    async jwt({ token, account, profile }) {
      // Initial sign-in: persist user + OAuth tokens (behind TokenStore).
      if (account && profile) {
        const p = profile as Profile & { picture?: string };
        const email = p.email;
        if (!isAllowedEmail(email)) return token; // defense in depth

        const dbUser = await prisma.user.upsert({
          where: { email: email as string },
          create: {
            email: email as string,
            name: p.name ?? null,
            image: p.picture ?? null,
          },
          update: {
            name: p.name ?? undefined,
            image: p.picture ?? undefined,
          },
        });

        await tokenStore.save(dbUser.id, GOOGLE_PROVIDER, {
          providerAccountId: account.providerAccountId,
          accessToken: account.access_token ?? null,
          refreshToken: account.refresh_token ?? null,
          expiresAt: account.expires_at ?? null,
          tokenType: account.token_type ?? null,
          scope: account.scope ?? null,
        });

        token.userId = dbUser.id;
        token.email = dbUser.email;

        await recordAudit({
          userId: dbUser.id,
          type: "login",
          action: "Signed in with Google",
          connector: GOOGLE_PROVIDER,
          success: true,
        });
        await recordAudit({
          userId: dbUser.id,
          type: "connector_access",
          action: "Linked Google connectors",
          connector: "google_calendar",
          success: true,
          metadata: { scopeGranted: Boolean(account.scope) },
        });
      }
      return token;
    },

    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
});
