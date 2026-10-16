import type { Metadata } from "next";
import Link from "next/link";
import { Plus, SquareKanban } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { Board } from "@/components/board/board";
import { BoardFiltersForm } from "@/components/board/filters";
import { WelcomeGuide } from "@/components/board/welcome-guide";
import { requireUser } from "@/lib/auth/session";
import { loadBoard } from "@/lib/board/service";
import { boardFilterSchema, firstParams } from "@/lib/validation/job";

export const metadata: Metadata = { title: "Board" };

export default async function BoardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const filters = boardFilterSchema.parse(firstParams(await searchParams));
  const data = await loadBoard(user.id, filters);
  const filtered = Object.entries(filters).some(([k, v]) => v !== undefined && k !== "sort");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Board"
        description={`${data.totalActive} active ${data.totalActive === 1 ? "job" : "jobs"}`}
        actions={
          <Link href="/jobs/new" className={buttonVariants({ variant: "primary" }) + " hidden tab:inline-flex"}>
            <Plus aria-hidden="true" className="size-4" /> Add job
          </Link>
        }
      />
      {data.totalActive === 0 ? (
        <>
          <WelcomeGuide />
          <EmptyState
            icon={SquareKanban}
            title="Your board is ready"
            action={
              <Link href="/jobs/new" className={buttonVariants({ variant: "primary" })}>
                <Plus aria-hidden="true" className="size-4" /> Add your first job
              </Link>
            }
          >
            Your five stages are set up: Wishlist, Applied, Interview, Offer and Rejected. Add a job by pasting its link or typing the details.
          </EmptyState>
        </>
      ) : (
        <>
          <BoardFiltersForm action="/board" filters={filters} stages={data.stages} tags={data.tags} jobBoards={data.jobBoards} />
          {filtered && data.cards.length === 0 ? <p className="text-secondary">No jobs match these filters.</p> : null}
          <Board stages={data.stages} cards={data.cards} sortable={!filters.sort || filters.sort === "position"} />
        </>
      )}
      {/* Phones: floating Add Job button (section 5). */}
      <Link
        href="/jobs/new"
        aria-label="Add job"
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-on-primary tab:hidden"
      >
        <Plus aria-hidden="true" className="size-6" />
      </Link>
    </div>
  );
}
