import "server-only";
import type { AuditEvent } from "@/lib/generated/prisma/enums";
import type { Prisma } from "@/lib/generated/prisma/client";
import { authDb, type Tx } from "@/lib/db";
import { clientInfo } from "@/lib/request";

type AuditInput = {
  event: AuditEvent;
  userId?: string | null;
  detail?: Prisma.InputJsonValue;
};

/**
 * Appends a security audit entry. Never pass document contents, passwords or
 * tokens in `detail`. The table is insert-only for the app roles.
 */
export async function audit(input: AuditInput, tx?: Tx): Promise<void> {
  const { ip, userAgent } = await clientInfo();
  const data = {
    event: input.event,
    userId: input.userId ?? null,
    ip,
    userAgent,
    detail: input.detail,
  };
  // createMany issues a plain INSERT without RETURNING: the app roles may
  // append audit rows but never read them back.
  // Inside a user transaction the RLS policy allows only that user's id.
  await (tx ?? authDb()).auditLog.createMany({ data: [data] });
}
