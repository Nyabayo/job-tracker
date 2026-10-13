import type { Metadata } from "next";
import { Archive } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Archive" };

export default function ArchivePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Archive" description="Jobs you've put away. Search them or bring them back." />
      <EmptyState icon={Archive} title="The archive is empty">
        When you archive a job it moves here, out of the way but never lost.
      </EmptyState>
    </div>
  );
}
