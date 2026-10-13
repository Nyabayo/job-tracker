import "server-only";
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { authDb } from "@/lib/db";
import { env, isSecureUrl } from "@/lib/env";
import { SESSION_MAX_AGE_SECONDS, SESSION_UPDATE_AGE_SECONDS, sessionCookieName } from "@/lib/auth/constants";

// Auth.js with database sessions (decision 4). Email/password login (A1)
// creates the session row itself in lib/auth/session.ts because Auth.js's
// Credentials provider only supports JWT sessions. Google and GitHub
// providers (A2) are added in Sprint 3 and will share the same session table.
export const { handlers, auth } = NextAuth(() => ({
  // The adapter types expect the default @prisma/client export; ours is
  // generated to lib/generated/prisma with an identical model API.
  adapter: PrismaAdapter(authDb() as unknown as Parameters<typeof PrismaAdapter>[0]),
  secret: env().AUTH_SECRET,
  trustHost: true,
  providers: [],
  session: {
    strategy: "database",
    maxAge: SESSION_MAX_AGE_SECONDS,
    updateAge: SESSION_UPDATE_AGE_SECONDS,
  },
  cookies: {
    sessionToken: {
      name: sessionCookieName(isSecureUrl()),
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: isSecureUrl() },
    },
  },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    // Expose only what the UI needs. Never the password hash or TOTP secret.
    session({ session, user }) {
      return {
        expires: session.expires,
        user: { id: user.id, email: user.email, name: user.name ?? null, image: user.image ?? null },
      } as typeof session;
    },
  },
}));
