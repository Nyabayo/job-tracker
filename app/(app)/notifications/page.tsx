import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { ActionButton } from "@/components/ui/confirm-button";
import { LocalTime } from "@/components/ui/local-time";
import { requireUser } from "@/lib/auth/session";
import { listNotifications } from "@/lib/board/details";
import { markAllReadAction } from "./actions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

/** Only links inside this app are ever rendered from a notification. */
function safeLink(link: string | null): string | null {
  return link && link.startsWith("/") && !link.startsWith("//") ? link : null;
}

/** G5: the notification centre. */
export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await listNotifications(user.id);
  const unread = items.some((n) => !n.readAt);
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Notifications"
        actions={
          unread ? (
            <ActionButton action={markAllReadAction} values={{}}>
              Mark all as read
            </ActionButton>
          ) : null
        }
      />
      {items.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications yet">
          Reminders for tasks, interviews and deadlines show up here.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((n) => {
            const href = safeLink(n.link);
            return (
              <li key={n.id}>
                <Card className={cn("flex flex-col gap-1 p-4", !n.readAt && "border-primary")}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold">
                      {!n.readAt ? <span className="sr-only">Unread: </span> : null}
                      {href ? (
                        <Link href={href} className="hover:underline">
                          {n.title}
                        </Link>
                      ) : (
                        n.title
                      )}
                    </p>
                    <span className="shrink-0 text-sm text-secondary">
                      <LocalTime value={n.createdAt} />
                    </span>
                  </div>
                  {n.body ? <p className="text-sm text-secondary">{n.body}</p> : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
