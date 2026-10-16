import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { authDb } from "@/lib/db";
import { env, isSecureUrl } from "@/lib/env";
import {
  checkTotp,
  decryptSecret,
  encryptSecret,
  hashRecoveryCode,
  newRecoveryCodes,
  newTotpSecret,
  normaliseRecoveryCode,
  totpUri,
} from "@/lib/auth/totp";

// A4: two-factor login. After the password (or Google/GitHub) step succeeds
// for a user with 2FA on, no session is created. Instead the browser gets a
// short-lived signed ticket naming the user, and the session starts only
// after a valid authenticator or recovery code.

const TICKET_TTL_MS = 5 * 60 * 1000;

function ticketCookie(): string {
  return isSecureUrl() ? "__Host-jt.2fa" : "jt.2fa";
}

function sign(payload: string): string {
  return createHmac("sha256", `two-factor-ticket:${env().AUTH_SECRET}`).update(payload).digest("base64url");
}

type Ticket = { userId: string; next: string };

export function encodeTicket(ticket: Ticket, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ u: ticket.userId, n: ticket.next, e: now + TICKET_TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeTicket(value: string | undefined, now = Date.now()): Ticket | null {
  if (!value) return null;
  const [payload, mac] = value.split(".");
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { u?: unknown; n?: unknown; e?: unknown };
    if (typeof data.u !== "string" || typeof data.n !== "string" || typeof data.e !== "number" || data.e <= now) return null;
    return { userId: data.u, next: data.n };
  } catch {
    return null;
  }
}

export async function issueTicket(ticket: Ticket): Promise<void> {
  (await cookies()).set(ticketCookie(), encodeTicket(ticket), {
    httpOnly: true,
    secure: isSecureUrl(),
    sameSite: "lax",
    path: "/",
    maxAge: TICKET_TTL_MS / 1000,
  });
}

export async function readTicket(): Promise<Ticket | null> {
  return decodeTicket((await cookies()).get(ticketCookie())?.value);
}

export async function clearTicket(): Promise<void> {
  (await cookies()).delete(ticketCookie());
}

export async function twoFactorEnabled(userId: string): Promise<boolean> {
  const user = await authDb().user.findUnique({ where: { id: userId }, select: { totpEnabled: true } });
  return user?.totpEnabled ?? false;
}

/**
 * Checks an authenticator code, or failing that a recovery code, and uses it
 * up. Returns which kind matched, or null.
 */
export async function redeemSecondFactor(userId: string, code: string): Promise<"totp" | "recovery" | null> {
  const user = await authDb().user.findUnique({
    where: { id: userId },
    select: { totpEnabled: true, totpSecret: true, totpLastStep: true, deletedAt: true },
  });
  if (!user?.totpEnabled || !user.totpSecret || user.deletedAt) return null;

  const trimmed = code.replace(/\s/g, "");
  const step = await checkTotp(decryptSecret(user.totpSecret), trimmed, user.totpLastStep);
  if (step !== null) {
    // Only move forward, so two requests racing with one code can't both win.
    const claimed = await authDb().user.updateMany({
      where: { id: userId, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
      data: { totpLastStep: step },
    });
    return claimed.count === 1 ? "totp" : null;
  }

  if (normaliseRecoveryCode(trimmed).length !== 11) return null;
  const used = await authDb().recoveryCode.updateMany({
    where: { userId, codeHash: hashRecoveryCode(trimmed), usedAt: null },
    data: { usedAt: new Date() },
  });
  return used.count === 1 ? "recovery" : null;
}

/** Step 1 of setup: a new secret, stored encrypted but not yet switched on. */
export async function beginSetup(userId: string, email: string): Promise<{ secret: string; uri: string } | null> {
  const user = await authDb().user.findUnique({ where: { id: userId }, select: { totpEnabled: true } });
  if (!user || user.totpEnabled) return null;
  const secret = newTotpSecret();
  await authDb().user.update({
    where: { id: userId },
    data: { totpSecret: encryptSecret(secret), totpLastStep: null },
    select: { id: true },
  });
  return { secret, uri: totpUri(secret, email) };
}

async function replaceRecoveryCodes(userId: string): Promise<string[]> {
  const codes = newRecoveryCodes();
  await authDb().$transaction([
    authDb().recoveryCode.deleteMany({ where: { userId } }),
    authDb().recoveryCode.createMany({ data: codes.map((c) => ({ userId, codeHash: hashRecoveryCode(c) })) }),
  ]);
  return codes;
}

/** Step 2 of setup: a code from the app proves it was added. Returns the recovery codes, shown once. */
export async function confirmSetup(userId: string, code: string): Promise<string[] | null> {
  const user = await authDb().user.findUnique({ where: { id: userId }, select: { totpEnabled: true, totpSecret: true } });
  if (!user || user.totpEnabled || !user.totpSecret) return null;
  const step = await checkTotp(decryptSecret(user.totpSecret), code.replace(/\s/g, ""), null);
  if (step === null) return null;
  const switched = await authDb().user.updateMany({
    where: { id: userId, totpEnabled: false, totpSecret: user.totpSecret },
    data: { totpEnabled: true, totpLastStep: step },
  });
  if (switched.count !== 1) return null;
  return replaceRecoveryCodes(userId);
}

export async function disableTwoFactor(userId: string, code: string): Promise<boolean> {
  if (!(await redeemSecondFactor(userId, code))) return false;
  await authDb().$transaction([
    authDb().user.update({ where: { id: userId }, data: { totpEnabled: false, totpSecret: null, totpLastStep: null }, select: { id: true } }),
    authDb().recoveryCode.deleteMany({ where: { userId } }),
  ]);
  return true;
}

export async function regenerateRecoveryCodes(userId: string, code: string): Promise<string[] | null> {
  if (!(await redeemSecondFactor(userId, code))) return null;
  return replaceRecoveryCodes(userId);
}

export async function twoFactorStatus(userId: string): Promise<{ enabled: boolean; codesLeft: number }> {
  const [user, codesLeft] = await Promise.all([
    authDb().user.findUnique({ where: { id: userId }, select: { totpEnabled: true } }),
    authDb().recoveryCode.count({ where: { userId, usedAt: null } }),
  ]);
  return { enabled: user?.totpEnabled ?? false, codesLeft };
}
