"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authDb } from "@/lib/db";
import { audit } from "@/lib/audit";
import { isSecureUrl } from "@/lib/env";
import { requireUser } from "@/lib/auth/session";
import { sessionCookieName } from "@/lib/auth/constants";
import { verifyPassword } from "@/lib/auth/password";
import { takeToken } from "@/lib/rate-limit";
import { enqueueAccountPurge } from "@/lib/jobs";
import { sendAccountDeletedEmail } from "@/lib/email";
import { invalid, type ActionResult } from "@/lib/action-result";
import { deleteAccountSchema } from "@/lib/validation/auth";
import { CSRF_FAILED, csrfValid } from "@/lib/security/csrf";

/**
 * A7: permanently delete my account.
 * 1. Re-check the password.
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

  const record = await authDb().user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(record?.passwordHash, parsed.data.password))) {
    return { ok: false, fieldErrors: { password: ["That password isn't right."] }, message: "That password isn't right." };
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
