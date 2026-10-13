import type { Metadata } from "next";
import { ChartColumn } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" description="See which CV, cover letter and job board get you interviews." />
      <EmptyState icon={ChartColumn} title="No numbers yet">
        Once you’ve added a few applications, your response, interview and offer rates will show here.
      </EmptyState>
    </div>
  );
}
