import "server-only";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { authDb } from "@/lib/db";
import { audit } from "@/lib/audit";
import { env, isSecureUrl, oauthProviders } from "@/lib/env";
import { SESSION_MAX_AGE_SECONDS, SESSION_UPDATE_AGE_SECONDS, sessionCookieName } from "@/lib/auth/constants";
import { issueTicket } from "@/lib/auth/two-factor";

// Auth.js with database sessions (decision 4). Email/password login (A1)
// creates the session row itself in lib/auth/session.ts because Auth.js's
// Credentials provider only supports JWT sessions. Google and GitHub (A2)
// go through Auth.js and share the same session table.
export const { handlers, auth, signIn } = NextAuth(() => {
  const e = env();
  // OAuth redirect and callback URLs come from APP_URL, never from the
  // request's Host header.
  process.env.AUTH_URL ??= `${e.APP_URL}/api/auth`;
  const enabled = oauthProviders();
  return {
    // The adapter types expect the default @prisma/client export; ours is
    // generated to lib/generated/prisma with an identical model API.
    adapter: PrismaAdapter(authDb() as unknown as Parameters<typeof PrismaAdapter>[0]),
    secret: e.AUTH_SECRET,
    trustHost: true,
    // Linking by matching email stays off (Auth.js default): a Google or
    // GitHub account can't take over an existing password account.
    providers: [
      ...(enabled.includes("google") ? [Google({ clientId: e.AUTH_GOOGLE_ID, clientSecret: e.AUTH_GOOGLE_SECRET })] : []),
      ...(enabled.includes("github") ? [GitHub({ clientId: e.AUTH_GITHUB_ID, clientSecret: e.AUTH_GITHUB_SECRET })] : []),
    ],
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
      async signIn({ account }) {
        if (!account || (account.type !== "oidc" && account.type !== "oauth")) return false;
        const linked = await authDb().account.findUnique({
          where: { provider_providerAccountId: { provider: account.provider, providerAccountId: account.providerAccountId } },
          select: { user: { select: { id: true, deletedAt: true, totpEnabled: true } } },
        });
        // New Google/GitHub users are created by the adapter after this.
        if (!linked) return true;
        if (linked.user.deletedAt) return "/login?error=AccessDenied";
        if (linked.user.totpEnabled) {
          // A4: no session yet. The code step starts it.
          await issueTicket({ userId: linked.user.id, next: "/board" });
          return "/login/two-factor";
        }
        return true;
      },
      // Expose only what the UI needs. Never the password hash or TOTP secret.
      session({ session, user }) {
        return {
          expires: session.expires,
          user: { id: user.id, email: user.email, name: user.name ?? null, image: user.image ?? null },
        } as typeof session;
      },
    },
    events: {
      async createUser({ user }) {
        await audit({ event: "SIGNUP", userId: user.id ?? null, detail: { method: "oauth" } });
      },
      async signIn({ user, account }) {
        await audit({ event: "LOGIN_SUCCESS", userId: user.id ?? null, detail: { method: account?.provider ?? "oauth" } });
      },
    },
  };
});
