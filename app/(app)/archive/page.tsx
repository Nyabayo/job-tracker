import type { Metadata } from "next";
import Link from "next/link";
import { Archive } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ActionButton } from "@/components/ui/confirm-button";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { listArchived } from "@/lib/board/service";
import { boardFilterSchema, firstParams } from "@/lib/validation/job";
import { archiveJobAction, deleteJobAction } from "@/app/(app)/jobs/actions";
import { formatDay } from "@/lib/dates";

export const metadata: Metadata = { title: "Archive" };

/** B9: search and restore archived jobs. */
export default async function ArchivePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const filters = boardFilterSchema.parse(firstParams(await searchParams));
  const jobs = await listArchived(user.id, { q: filters.q, board: undefined });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Archive" description="Jobs you've put away. Restore one to put it back on the board." />
      <form method="get" action="/archive" role="search" className="flex gap-3">
        <label htmlFor="archive-q" className="sr-only">
          Search the archive
        </label>
        <Input id="archive-q" name="q" type="search" placeholder="Search title, company or location" defaultValue={filters.q ?? ""} />
        <button type="submit" className={buttonVariants({ variant: "primary" })}>
          Search
        </button>
      </form>
      {jobs.length === 0 ? (
        <EmptyState icon={Archive} title={filters.q ? "Nothing matches that search" : "Nothing archived"}>
          Archive a job from its page when you&apos;re done with it. It leaves the board but keeps everything.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {jobs.map((j) => (
            <li key={j.id}>
              <Card className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <Link href={`/jobs/${j.id}`} className="break-words font-bold hover:underline">
                    {j.title}
                  </Link>
                  <p className="text-sm text-secondary">
                    {j.companyName} · was in {j.stage.name} · archived {formatDay(j.archivedAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ActionButton action={archiveJobAction} values={{ jobId: j.id, archived: "false" }} variant="primary">
                    Restore
                  </ActionButton>
                  <ActionButton action={deleteJobAction} values={{ jobId: j.id }} variant="ghost" confirm="Delete forever, with its files?">
                    Delete
                  </ActionButton>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
