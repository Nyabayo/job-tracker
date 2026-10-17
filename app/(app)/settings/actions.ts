"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authDb } from "@/lib/db";
import { audit } from "@/lib/audit";
import { isSecureUrl } from "@/lib/env";
import { requireUser } from "@/lib/auth/session";
import { sessionCookieName } from "@/lib/auth/constants";
import { verifyPassword } from "@/lib/auth/password";
import {
  beginSetup,
  confirmSetup,
  disableTwoFactor,
  redeemSecondFactor,
  regenerateRecoveryCodes,
} from "@/lib/auth/two-factor";
import { takeToken } from "@/lib/rate-limit";
import { enqueueAccountPurge } from "@/lib/jobs";
import { sendAccountDeletedEmail } from "@/lib/email";
import { invalid, type ActionResult } from "@/lib/action-result";
import { deleteAccountSchema } from "@/lib/validation/auth";
import { CSRF_FAILED, csrfValid } from "@/lib/security/csrf";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withUser } from "@/lib/db";
import { formObject } from "@/lib/validation/forms";
import { CURRENCIES } from "@/lib/board/constants";

/**
 * A7: permanently delete my account.
 * 1. Re-check the password (if the account has one) and the 2FA code (if on).
 * 2. Mark the account deleted and end every session, so it can't be used again.
 * 3. Queue the purge job, which removes all files and records (within 24 hours;
 *    normally within a minute).
 */
export async function deleteAccountAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await csrfValid(input))) return CSRF_FAILED;
  const parsed = deleteAccountSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  if (!(await takeToken("deletePerUser", user.id))) {
    return { ok: false, message: "Too many attempts. Please wait a few minutes and try again." };
  }

  const record = await authDb().user.findUnique({ where: { id: user.id }, select: { passwordHash: true, totpEnabled: true } });
  if (record?.passwordHash && !(await verifyPassword(record.passwordHash, parsed.data.password ?? ""))) {
    return { ok: false, fieldErrors: { password: ["That password isn't right."] }, message: "That password isn't right." };
  }
  if (record?.totpEnabled && !(await redeemSecondFactor(user.id, parsed.data.code ?? ""))) {
    return { ok: false, fieldErrors: { code: ["That code isn't right."] }, message: "That code isn't right." };
  }

  await authDb().$transaction([
    authDb().user.update({ where: { id: user.id }, data: { deletedAt: new Date() }, select: { id: true } }),
    authDb().session.deleteMany({ where: { userId: user.id } }),
  ]);
  await audit({ event: "ACCOUNT_DELETION_REQUESTED", userId: user.id });
  await enqueueAccountPurge(user.id);
  await sendAccountDeletedEmail(user.email).catch((err: unknown) => console.error("[email]", err));

  (await cookies()).delete(sessionCookieName(isSecureUrl()));
  redirect("/goodbye");
}

const preferencesSchema = z.object({
  theme: z.enum(["LIGHT", "DARK", "SYSTEM"]),
  defaultCurrency: z.enum(CURRENCIES),
  emailReminders: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

/** A9 theme, G6 email reminders, default currency. */
export async function savePreferencesAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await csrfValid(formData))) return CSRF_FAILED;
  const parsed = preferencesSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  await withUser(user.id, (tx) => tx.user.update({ where: { id: user.id }, data: parsed.data, select: { id: true } }));
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved." };
}

// ---------------------------------------------------------------------------
// A4: two-factor authentication
// ---------------------------------------------------------------------------
export type TwoFactorResult = ActionResult & { secret?: string; uri?: string; recoveryCodes?: string[] };

const codeSchema = z.object({ code: z.string().trim().min(1, "Enter a code.").max(20) });
const WRONG_CODE: TwoFactorResult = { ok: false, fieldErrors: { code: ["That code isn't right. Check your app and try again."] } };
const SLOW_DOWN: TwoFactorResult = { ok: false, message: "Too many attempts. Please wait a few minutes and try again." };

export async function startTwoFactorAction(input: unknown): Promise<TwoFactorResult> {
  const user = await requireUser();
  if (!(await csrfValid(input))) return CSRF_FAILED;
  const setup = await beginSetup(user.id, user.email);
  if (!setup) return { ok: false, message: "Two-factor login is already on." };
  return { ok: true, ...setup };
}

export async function confirmTwoFactorAction(input: unknown): Promise<TwoFactorResult> {
  const user = await requireUser();
  if (!(await csrfValid(input))) return CSRF_FAILED;
  const parsed = codeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!(await takeToken("twoFactorPerUser", user.id))) return SLOW_DOWN;
  const recoveryCodes = await confirmSetup(user.id, parsed.data.code);
  if (!recoveryCodes) return WRONG_CODE;
  await audit({ event: "TWO_FACTOR_ENABLED", userId: user.id });
  revalidatePath("/settings");
  return { ok: true, message: "Two-factor login is on.", recoveryCodes };
}

export async function disableTwoFactorAction(input: unknown): Promise<TwoFactorResult> {
  const user = await requireUser();
  if (!(await csrfValid(input))) return CSRF_FAILED;
  const parsed = codeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!(await takeToken("twoFactorPerUser", user.id))) return SLOW_DOWN;
  if (!(await disableTwoFactor(user.id, parsed.data.code))) return WRONG_CODE;
  await audit({ event: "TWO_FACTOR_DISABLED", userId: user.id });
  revalidatePath("/settings");
  return { ok: true, message: "Two-factor login is off." };
}

export async function newRecoveryCodesAction(input: unknown): Promise<TwoFactorResult> {
  const user = await requireUser();
  if (!(await csrfValid(input))) return CSRF_FAILED;
  const parsed = codeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!(await takeToken("twoFactorPerUser", user.id))) return SLOW_DOWN;
  const recoveryCodes = await regenerateRecoveryCodes(user.id, parsed.data.code);
  if (!recoveryCodes) return WRONG_CODE;
  revalidatePath("/settings");
  return { ok: true, message: "New recovery codes are ready. The old ones no longer work.", recoveryCodes };
}
