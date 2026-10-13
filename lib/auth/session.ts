import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authDb } from "@/lib/db";
import { isSecureUrl } from "@/lib/env";
import { auth } from "@/lib/auth/config";
import { generateToken } from "@/lib/auth/tokens";
import { SESSION_MAX_AGE_SECONDS, sessionCookieName } from "@/lib/auth/constants";

export type SessionUser = { id: string; email: string; name: string | null };

function cookieName(): string {
  return sessionCookieName(isSecureUrl());
}

/**
 * Starts a new database session after a successful login and sets the cookie.
 * Any session the browser already had is deleted first (rotation on login).
 */
export async function startSession(userId: string): Promise<void> {
  const jar = await cookies();
  const previous = jar.get(cookieName())?.value;
  if (previous) await authDb().session.deleteMany({ where: { sessionToken: previous } });

  const sessionToken = generateToken();
  const expires = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await authDb().session.create({ data: { sessionToken, userId, expires }, select: { id: true } });

  jar.set(cookieName(), sessionToken, {
    httpOnly: true,
    secure: isSecureUrl(),
    sameSite: "lax",
    path: "/",
    expires,
  });
}

/** Ends the current session on the server and clears the cookie. */
export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(cookieName())?.value;
  if (token) await authDb().session.deleteMany({ where: { sessionToken: token } });
  jar.delete(cookieName());
}

/** Ends every session a user has, on every device. */
export async function endAllSessions(userId: string): Promise<void> {
  await authDb().session.deleteMany({ where: { userId } });
}

/** The signed-in user, or null. Cached for the duration of one request. */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  const email = session?.user?.email;
  if (!id || !email) return null;
  return { id, email, name: session.user?.name ?? null };
});

/** For pages and actions that need a signed-in user. */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
