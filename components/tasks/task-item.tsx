"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { useCsrfToken } from "@/components/security/csrf";
import { useToast } from "@/components/ui/toast";
import { ActionButton } from "@/components/ui/confirm-button";
import { LocalTime } from "@/components/ui/local-time";
import { CSRF_FIELD } from "@/lib/security/csrf-shared";
import { label } from "@/lib/board/constants";
import { removeTaskAction, setTaskDoneAction } from "@/app/(app)/jobs/actions";
import { cn } from "@/lib/utils";

export type TaskView = {
  id: string;
  title: string;
  kind: string;
  interviewType: string | null;
  dueAt: Date | string | null;
  completedAt: Date | string | null;
  notes: string | null;
  job?: { id: string; title: string; companyName: string } | null;
};

/** G1, G3, G4: one task with a done checkbox. */
export function TaskItem({ task, overdue = false }: { task: TaskView; overdue?: boolean }) {
  const csrf = useCsrfToken();
  const toast = useToast();
  const [pending, start] = useTransition();
  const done = Boolean(task.completedAt);
  return (
    <li className={cn("flex items-start gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-3", overdue && !done && "border-danger")}>
      <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center">
        <input
          type="checkbox"
          className="size-11 shrink-0 cursor-pointer accent-[var(--primary)]"
          checked={done}
          disabled={pending}
          onChange={(e) =>
            start(async () => {
              const r = await setTaskDoneAction({ taskId: task.id, done: e.target.checked, [CSRF_FIELD]: csrf });
              if (!r.ok) toast({ message: r.message ?? "Couldn't update the task.", tone: "danger" });
            })
          }
        />
        <span className="sr-only">{done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}</span>
      </label>
      <div className="min-w-0 flex-1 py-1">
        <p className={cn("break-words font-semibold", done && "text-secondary line-through")}>{task.title}</p>
        <p className="text-sm text-secondary">
          {[task.kind !== "TASK" ? label(task.kind) : null, task.interviewType ? label(task.interviewType) : null].filter(Boolean).join(" · ")}
          {task.dueAt ? (
            <>
              {task.kind !== "TASK" ? " · " : ""}
              {overdue && !done ? <span className="font-semibold text-danger">Overdue · </span> : null}
              Due <LocalTime value={task.dueAt} />
            </>
          ) : null}
        </p>
        {task.job ? (
          <Link href={`/jobs/${task.job.id}?tab=tasks`} className="text-sm font-semibold text-primary underline">
            {task.job.title} at {task.job.companyName}
          </Link>
        ) : null}
        {task.notes ? <p className="mt-1 whitespace-pre-line text-sm">{task.notes}</p> : null}
      </div>
      <ActionButton action={removeTaskAction} values={{ taskId: task.id }} variant="ghost" size="icon" label={`Delete task ${task.title}`} confirm="Delete?">
        <Trash2 aria-hidden="true" className="size-4" />
      </ActionButton>
    </li>
  );
}
