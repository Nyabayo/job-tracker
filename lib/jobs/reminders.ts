import "server-only";
import { authDb } from "@/lib/db";
import { sendReminderEmail } from "@/lib/email";

export const REMINDER_QUEUE = "reminders";

type Due = { user_id: string; title: string; due_at: Date | null; kind: string; link: string };

/**
 * G1, G5, G6: runs every minute. The database functions claim each due
 * reminder and deadline exactly once and write the in-app notification;
 * here we only send the optional emails.
 */
export async function runReminders(): Promise<number> {
  const db = authDb();
  const [tasks, deadlines] = await Promise.all([
    db.$queryRaw<Due[]>`SELECT * FROM claim_due_reminders(500)`,
    db.$queryRaw<Due[]>`SELECT * FROM claim_deadline_alerts(500)`,
  ]);
  const due = [...tasks, ...deadlines];
  if (due.length === 0) return 0;
  const users = await db.user.findMany({
    where: { id: { in: [...new Set(due.map((d) => d.user_id))] }, emailReminders: true, deletedAt: null, emailVerified: { not: null } },
    select: { id: true, email: true },
  });
  const emailOf = new Map(users.map((u) => [u.id, u.email]));
  for (const d of due) {
    const to = emailOf.get(d.user_id);
    if (!to) continue;
    const prefix = d.kind === "DEADLINE" ? "Deadline soon: " : d.kind === "INTERVIEW" ? "Interview: " : "";
    await sendReminderEmail(to, `${prefix}${d.title}`, d.link).catch((err: unknown) => console.error("[reminders]", err));
  }
  return due.length;
}
