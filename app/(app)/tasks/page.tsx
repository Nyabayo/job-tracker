import type { Metadata } from "next";
import { SquareCheck } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Tasks" };

export default function TasksPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Tasks" description="Follow-ups, interviews and deadlines in one list." />
      <EmptyState icon={SquareCheck} title="Nothing due">
        Tasks and interview reminders you add to your jobs will appear here, sorted into Overdue, Today and Upcoming.
      </EmptyState>
    </div>
  );
}
