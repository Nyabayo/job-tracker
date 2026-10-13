import "server-only";
import { authDb } from "@/lib/db";
import { deleteUserFiles } from "@/lib/storage";

export const ACCOUNT_PURGE_QUEUE = "account-purge";
export const ACCOUNT_PURGE_SWEEP_QUEUE = "account-purge-sweep";

/**
 * A7: permanently deletes a user who asked to close their account.
 * Files go first, then the user row; every user-owned table cascades from it.
 * Safe to run twice: a user that is already gone is a no-op.
 */
export async function purgeAccount(userId: string): Promise<void> {
  const user = await authDb().user.findUnique({ where: { id: userId }, select: { deletedAt: true } });
  if (!user) return;
  if (!user.deletedAt) throw new Error("Refusing to purge an account that was not marked for deletion");

  await deleteUserFiles(userId);
  await authDb().user.delete({ where: { id: userId }, select: { id: true } });
  await authDb().auditLog.createMany({ data: [{ event: "ACCOUNT_DELETED", userId: null, detail: { purged: true } }] });
}

/** Ids of accounts marked for deletion that are still in the database. */
export async function accountsAwaitingPurge(limit = 100): Promise<string[]> {
  const rows = await authDb().user.findMany({
    where: { deletedAt: { not: null } },
    select: { id: true },
    orderBy: { deletedAt: "asc" },
    take: limit,
  });
  return rows.map((r) => r.id);
}
