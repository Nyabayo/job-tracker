import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { TaskGroups } from "@/components/tasks/task-groups";
import { AddTaskForm } from "@/components/jobs/detail-forms";
import { requireUser } from "@/lib/auth/session";
import { listTasks } from "@/lib/board/details";

export const metadata: Metadata = { title: "Tasks" };

/** G4: Overdue, Today, Upcoming, Completed. */
export default async function TasksPage() {
  const user = await requireUser();
  const tasks = await listTasks(user.id);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Tasks" description="Follow-ups, interviews and everything else to do." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
        <TaskGroups tasks={tasks} />
        <Card className="h-fit p-4">
          <h2 className="mb-3 text-lg font-bold">Add a task</h2>
          <AddTaskForm jobId={null} />
        </Card>
      </div>
    </div>
  );
}
