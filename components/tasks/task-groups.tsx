"use client";

import { useSyncExternalStore } from "react";
import { TaskItem, type TaskView } from "@/components/tasks/task-item";
import { groupTasks } from "@/lib/board/task-groups";

const subscribe = () => () => {};

/** Groups by the viewer's local day, so "Today" means today where they are. */
export function TaskGroups({ tasks }: { tasks: TaskView[] }) {
  const now = useSyncExternalStore(subscribe, () => Math.floor(Date.now() / 60_000) * 60_000, () => 0);
  if (!now) return <p className="text-secondary">Loading tasks...</p>;
  const groups = groupTasks(tasks, new Date(now));
  const sections = [
    { key: "overdue", title: "Overdue", items: groups.overdue, empty: "Nothing overdue." },
    { key: "today", title: "Today", items: groups.today, empty: "Nothing due today." },
    { key: "upcoming", title: "Upcoming", items: groups.upcoming, empty: "Nothing coming up." },
    { key: "completed", title: "Completed", items: groups.completed, empty: "No completed tasks yet." },
  ] as const;
  return (
    <div className="flex flex-col gap-6">
      {sections.map((s) => (
        <section key={s.key} aria-labelledby={`tasks-${s.key}`} className="flex flex-col gap-3">
          <h2 id={`tasks-${s.key}`} className="text-lg font-bold">
            {s.title} <span className="text-secondary">({s.items.length})</span>
          </h2>
          {s.items.length === 0 ? <p className="text-sm text-secondary">{s.empty}</p> : null}
          <ul className="flex flex-col gap-3">
            {s.items.map((t) => (
              <TaskItem key={t.id} task={t} overdue={s.key === "overdue"} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
