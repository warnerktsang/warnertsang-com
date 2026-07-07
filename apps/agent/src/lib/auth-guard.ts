import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}

/**
 * Resolves the current user from the session, re-verifying the allowlist
 * server-side (defense in depth — never trust the client or a stale token).
 * Returns null when unauthenticated or not authorized.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.email) return null;
  if (user.email.toLowerCase() !== env.ALLOWED_GOOGLE_EMAIL.toLowerCase()) {
    return null;
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
  };
}

/** For server components: redirect to /login when not authorized. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
