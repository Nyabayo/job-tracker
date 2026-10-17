"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { authDb } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientInfo } from "@/lib/request";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { generateToken, hashToken, isExpired, PASSWORD_RESET_TTL_MS, VERIFY_EMAIL_TTL_MS } from "@/lib/auth/tokens";
import { endAllSessions, endSession, startSession } from "@/lib/auth/session";
import { clearLoginFailures, loginLockRemaining, recordLoginFailure, takeIpToken, takeToken } from "@/lib/rate-limit";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";
import { signIn } from "@/lib/auth/config";
import { clearTicket, issueTicket, readTicket, redeemSecondFactor, twoFactorEnabled } from "@/lib/auth/two-factor";
import { oauthProviders } from "@/lib/env";
import { invalid, safeNextPath, type ActionResult } from "@/lib/action-result";
import { CSRF_FAILED, csrfValid } from "@/lib/security/csrf";
import {
  forgotPasswordSchema,
  loginSchema,
  oauthSchema,
  twoFactorSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  signUpSchema,
  verifyEmailSchema,
} from "@/lib/validation/auth";

const TOO_MANY = "Too many attempts. Please wait a few minutes and try again.";
const BAD_LOGIN = "That email and password don't match an account. Check them and try again.";

/**
 * Sends email after the response is finished, so the response time doesn't
 * reveal whether an email went out (and so whether the account exists).
 */
function sendLater(send: () => Promise<void>): void {
  after(() => send().catch((err: unknown) => console.error("[email]", err)));
}

async function issueVerificationToken(email: string): Promise<void> {
  const token = generateToken();
  await authDb().verificationToken.deleteMany({ where: { identifier: email } });
  await authDb().verificationToken.create({
    data: { identifier: email, token: hashToken(token), expires: new Date(Date.now() + VERIFY_EMAIL_TTL_MS) },
    select: { token: true },
  });
  sendLater(() => sendVerificationEmail(email, token));
}

// ---------------------------------------------------------------------------
// A1: sign up
// ---------------------------------------------------------------------------
export async function signUpAction(input: unknown): Promise<ActionResult> {
  if (!(await csrfValid(input))) return CSRF_FAILED;
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { email, password, name } = parsed.data;

  const { rawIp } = await clientInfo();
  if (!(await takeIpToken("signupPerIp", rawIp))) return { ok: false, message: TOO_MANY };

  // Hash first so the response takes the same time whether or not the email exists.
  const passwordHash = await hashPassword(password);
  const existing = await authDb().user.findUnique({ where: { email }, select: { id: true, emailVerified: true, deletedAt: true } });

  if (!existing) {
    const user = await authDb().user.create({
      data: { email, passwordHash, name: name || null },
      select: { id: true },
    });
    await audit({ event: "SIGNUP", userId: user.id });
    await issueVerificationToken(email);
  } else if (!existing.emailVerified && !existing.deletedAt && (await takeToken("verifyPerEmail", email))) {
    // Someone signing up again before confirming: the newest sign-up's
    // password is the one the emailed link confirms. Otherwise whoever
    // registered the address first (perhaps not its owner) would keep a
    // password on the account the real owner then verifies.
    await authDb().user.update({
      where: { id: existing.id },
      data: { passwordHash, name: name || null },
      select: { id: true },
    });
    await issueVerificationToken(email);
  }
  // Same answer either way, so sign-up can't be used to discover accounts.
  redirect(`/check-email?for=signup`);
}

// ---------------------------------------------------------------------------
// A1: log in, log out
// ---------------------------------------------------------------------------
export async function loginAction(input: unknown, next?: unknown): Promise<ActionResult> {
  if (!(await csrfValid(input))) return CSRF_FAILED;
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { email, password } = parsed.data;

  const { rawIp } = await clientInfo();
  if (!(await takeIpToken("loginPerIp", rawIp))) return { ok: false, message: TOO_MANY };

  const locked = await loginLockRemaining(email);
  if (locked > 0) {
    await audit({ event: "LOGIN_LOCKED", detail: { lockedForSeconds: locked } });
    const minutes = Math.max(1, Math.ceil(locked / 60));
    return { ok: false, message: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}, or reset your password.` };
  }

  const user = await authDb().user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, emailVerified: true, deletedAt: true },
  });
  const live = user && !user.deletedAt ? user : null;
  const valid = await verifyPassword(live?.passwordHash, password);

  if (!live || !valid) {
    await recordLoginFailure(email);
    await audit({ event: "LOGIN_FAILED", userId: live?.id ?? null });
    return { ok: false, message: BAD_LOGIN };
  }

  if (!live.emailVerified) {
    if (await takeToken("verifyPerEmail", email)) await issueVerificationToken(email);
    return { ok: false, message: "Please confirm your email first. We've sent you a new link." };
  }

  await clearLoginFailures(email);
  if (await twoFactorEnabled(live.id)) {
    // A4: the password was right, but the session waits for the code.
    await issueTicket({ userId: live.id, next: safeNextPath(next) });
    redirect("/login/two-factor");
  }
  await startSession(live.id);
  await audit({ event: "LOGIN_SUCCESS", userId: live.id });
  redirect(safeNextPath(next));
}

// ---------------------------------------------------------------------------
// A4: second step of login
// ---------------------------------------------------------------------------
export async function twoFactorLoginAction(input: unknown): Promise<ActionResult> {
  if (!(await csrfValid(input))) return CSRF_FAILED;
  const parsed = twoFactorSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const ticket = await readTicket();
  if (!ticket) return { ok: false, message: "This login has timed out. Please log in again." };
  if (!(await takeToken("twoFactorPerUser", ticket.userId))) return { ok: false, message: TOO_MANY };

  const used = await redeemSecondFactor(ticket.userId, parsed.data.code);
  if (!used) {
    await audit({ event: "LOGIN_FAILED", userId: ticket.userId, detail: { step: "two-factor" } });
    return { ok: false, fieldErrors: { code: ["That code isn't right. Check your app and try again."] } };
  }

  await clearTicket();
  await startSession(ticket.userId);
  await audit({ event: "LOGIN_SUCCESS", userId: ticket.userId, detail: { secondFactor: used } });
  redirect(safeNextPath(ticket.next));
}

// ---------------------------------------------------------------------------
// A2: Google and GitHub
// ---------------------------------------------------------------------------
export async function oauthLoginAction(input: unknown): Promise<ActionResult> {
  if (!(await csrfValid(input))) return CSRF_FAILED;
  const parsed = oauthSchema.safeParse(input);
  if (!parsed.success || !oauthProviders().includes(parsed.data.provider)) {
    return { ok: false, message: "That sign-in option isn't available." };
  }
  const { rawIp } = await clientInfo();
  if (!(await takeIpToken("loginPerIp", rawIp))) return { ok: false, message: TOO_MANY };
  // Redirects to the provider; Auth.js checks state and PKCE on the way back.
  await signIn(parsed.data.provider, { redirectTo: "/board" });
  return { ok: true };
}

export async function logoutAction(formData: FormData): Promise<void> {
  if (!(await csrfValid(formData))) redirect("/settings");
  await endSession();
  redirect("/login");
}

// ---------------------------------------------------------------------------
// A3: verify email
// ---------------------------------------------------------------------------
export async function verifyEmailAction(input: unknown): Promise<ActionResult> {
  if (!(await csrfValid(input))) return CSRF_FAILED;
  const parsed = verifyEmailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "This link is not valid. Request a new one below." };

  const record = await authDb().verificationToken.findUnique({ where: { token: hashToken(parsed.data.token) } });
  if (!record || isExpired(record.expires)) {
    return { ok: false, message: "This link has expired or was already used. Request a new one below." };
  }

  const verifiedUserId = await authDb().$transaction(async (tx) => {
    await tx.verificationToken.deleteMany({ where: { identifier: record.identifier } });
    const user = await tx.user.findUnique({ where: { email: record.identifier }, select: { id: true, deletedAt: true } });
    if (!user || user.deletedAt) return null;
    await tx.user.update({ where: { id: user.id }, data: { emailVerified: new Date() }, select: { id: true } });
    return user.id;
  });
  if (!verifiedUserId) return { ok: false, message: "This link is not valid. Request a new one below." };

  await audit({ event: "EMAIL_VERIFIED", userId: verifiedUserId });
  redirect("/login?verified=1");
}

export async function resendVerificationAction(input: unknown): Promise<ActionResult> {
  if (!(await csrfValid(input))) return CSRF_FAILED;
  const parsed = resendVerificationSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { email } = parsed.data;

  if (await takeToken("verifyPerEmail", email)) {
    const user = await authDb().user.findUnique({ where: { email }, select: { emailVerified: true, deletedAt: true } });
    if (user && !user.emailVerified && !user.deletedAt) await issueVerificationToken(email);
  }
  return { ok: true, message: "If that email needs confirming, a new link is on its way." };
}

// ---------------------------------------------------------------------------
// A3: forgotten password
// ---------------------------------------------------------------------------
export async function forgotPasswordAction(input: unknown): Promise<ActionResult> {
  if (!(await csrfValid(input))) return CSRF_FAILED;
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { email } = parsed.data;

  const { rawIp } = await clientInfo();
  const allowed = (await takeIpToken("resetPerIp", rawIp)) && (await takeToken("resetPerEmail", email));

  if (allowed) {
    const user = await authDb().user.findUnique({ where: { email }, select: { id: true, deletedAt: true } });
    if (user && !user.deletedAt) {
      const token = generateToken();
      await authDb().$transaction([
        // Only the newest link works.
        authDb().passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
        authDb().passwordResetToken.create({
          data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS) },
          select: { id: true },
        }),
      ]);
      await audit({ event: "PASSWORD_RESET_REQUESTED", userId: user.id });
      sendLater(() => sendPasswordResetEmail(email, token));
    }
  }
  redirect("/check-email?for=reset");
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  if (!(await csrfValid(input))) return CSRF_FAILED;
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const expired = { ok: false, message: "This reset link has expired or was already used. Request a new one." };

  const tokenHash = hashToken(parsed.data.token);
  const record = await authDb().passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, usedAt: true, expiresAt: true, user: { select: { deletedAt: true } } },
  });
  if (!record || record.usedAt || isExpired(record.expiresAt) || record.user.deletedAt) return expired;

  const passwordHash = await hashPassword(parsed.data.password);
  const changed = await authDb().$transaction(async (tx) => {
    // Single use: only the first request to flip used_at wins.
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) return false;
    const current = await tx.user.findUniqueOrThrow({ where: { id: record.userId }, select: { emailVerified: true } });
    await tx.user.update({
      where: { id: record.userId },
      // Following the emailed link proves the person controls the address.
      data: { passwordHash, emailVerified: current.emailVerified ?? new Date() },
      select: { id: true },
    });
    return true;
  });
  if (!changed) return expired;

  // Sign out everywhere: whoever knew the old password loses access.
  await endAllSessions(record.userId);
  await audit({ event: "PASSWORD_RESET", userId: record.userId });
  redirect("/login?reset=1");
}
