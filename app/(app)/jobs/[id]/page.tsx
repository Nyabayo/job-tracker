import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { JobDetail } from "@/components/jobs/job-detail";

export const metadata: Metadata = { title: "Job" };

export default async function JobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const { id } = await params;
  return <JobDetail userId={user.id} id={id} sp={await searchParams} view={{ kind: "page" }} />;
}
