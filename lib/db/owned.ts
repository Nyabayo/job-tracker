import "server-only";
import { z } from "zod";
import { authDb, type Tx } from "@/lib/db";
import { audit } from "@/lib/audit";

/** Tables whose rows can be fetched by id from a URL or API call. */
export type OwnedTable =
  | "stages" | "jobs" | "job_links" | "tags" | "notes" | "documents"
  | "contacts" | "tasks" | "notifications" | "timeline_events" | "inbox_items";

const uuid = z.uuid();

export function isUuid(value: string): boolean {
  return uuid.safeParse(value).success;
}

/**
 * A5: call after an RLS-filtered lookup by id came back empty. If the id
 * belongs to someone else, writes an ACCESS_DENIED audit entry. The caller
 * always responds 404 either way, so nothing leaks.
 *
 * The audit row is written on a separate connection so it survives even when
 * the caller's transaction is rolled back.
 */
export async function recordMissingRow(tx: Tx, userId: string, table: OwnedTable, id: string): Promise<void> {
  if (!isUuid(id)) return;
  const rows = await tx.$queryRaw<{ exists: boolean }[]>`SELECT row_exists(${table}, ${id}::uuid) AS "exists"`;
  if (rows[0]?.exists) {
    await audit({ event: "ACCESS_DENIED", userId, detail: { table, id } });
  }
}

/** Returns the row, or records the attempt and returns null (respond 404). */
export async function ownedOrNull<T>(
  tx: Tx,
  userId: string,
  table: OwnedTable,
  id: string,
  row: T | null,
): Promise<T | null> {
  if (row) return row;
  await recordMissingRow(tx, userId, table, id);
  return null;
}

// Re-exported so route handlers can audit outside a transaction.
export { authDb };
