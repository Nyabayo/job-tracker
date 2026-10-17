"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { CSRF_FAILED, csrfValid } from "@/lib/security/csrf";
import type { ActionResult } from "@/lib/action-result";
import { markAllRead } from "@/lib/board/details";

/** G5: clears the unread count. */
export async function markAllReadAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await csrfValid(input))) return CSRF_FAILED;
  await markAllRead(user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}
