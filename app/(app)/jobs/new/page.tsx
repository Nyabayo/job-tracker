import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { JobForm } from "@/components/jobs/job-form";
import { requireUser } from "@/lib/auth/session";
import { listStages } from "@/lib/board/service";
import { withUser } from "@/lib/db";

export const metadata: Metadata = { title: "Add job" };

/** C1, C2: add a job by link or by hand. */
export default async function NewJobPage() {
  const user = await requireUser();
  const [stages, settings] = await Promise.all([
    listStages(user.id),
    withUser(user.id, (tx) => tx.user.findFirst({ where: { id: user.id }, select: { defaultCurrency: true } })),
  ]);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader title="Add a job" description="Only the title and company are needed. You can add the rest later." />
      <JobForm stages={stages} withImport defaultCurrency={settings?.defaultCurrency} />
    </div>
  );
}
