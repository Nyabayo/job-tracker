import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { SORTS, WORK_TYPES, label } from "@/lib/board/constants";
import type { BoardFilters } from "@/lib/validation/job";

type Option = { id: string; name: string };

function FilterField({ id, text, children }: { id: string; text: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {text}
      </label>
      {children}
    </div>
  );
}

/**
 * B6: search, filter and sort. A plain GET form, so it works without
 * JavaScript and every filter is a shareable URL.
 */
export function BoardFiltersForm({
  action,
  filters,
  stages,
  tags,
  jobBoards,
  showSort = true,
}: {
  action: string;
  filters: BoardFilters;
  stages: Option[];
  tags: Option[];
  jobBoards: string[];
  showSort?: boolean;
}) {
  const active = Object.entries(filters).filter(([k, v]) => v !== undefined && k !== "sort" && k !== "q").length;
  return (
    <form method="get" action={action} role="search" className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label htmlFor="filter-q" className="sr-only">
            Search jobs
          </label>
          <Input id="filter-q" name="q" type="search" placeholder="Search title, company or location" defaultValue={filters.q ?? ""} />
        </div>
        {showSort ? (
          <div className="w-full tab:w-52">
            <label htmlFor="filter-sort" className="sr-only">
              Sort by
            </label>
            <Select id="filter-sort" name="sort" defaultValue={filters.sort ?? "position"}>
              {Object.entries(SORTS).map(([value, text]) => (
                <option key={value} value={value}>
                  Sort: {text}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        <button type="submit" className={buttonVariants({ variant: "primary" })}>
          Search
        </button>
      </div>
      <details open={active > 0} className="group">
        <summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] px-2 font-semibold">
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          Filters{active > 0 ? ` (${active})` : ""}
        </summary>
        <div className="mt-3 grid grid-cols-1 gap-3 tab:grid-cols-2 lg:grid-cols-4">
          <FilterField id="filter-stage" text="Stage">
            <Select id="filter-stage" name="stage" defaultValue={filters.stage ?? ""}>
              <option value="">Any stage</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField id="filter-board" text="Job board">
            <Select id="filter-board" name="board" defaultValue={filters.board ?? ""}>
              <option value="">Any job board</option>
              {jobBoards.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField id="filter-rating" text="Excitement">
            <Select id="filter-rating" name="rating" defaultValue={filters.rating ? String(filters.rating) : ""}>
              <option value="">Any rating</option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n === 5 ? "5 stars" : `${n}+ stars`}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField id="filter-work" text="Work type">
            <Select id="filter-work" name="workType" defaultValue={filters.workType ?? ""}>
              <option value="">Any work type</option>
              {WORK_TYPES.map((w) => (
                <option key={w} value={w}>
                  {label(w)}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField id="filter-country" text="Country code">
            <Input id="filter-country" name="country" maxLength={2} placeholder="e.g. KE" defaultValue={filters.country ?? ""} autoCapitalize="characters" />
          </FilterField>
          <FilterField id="filter-tag" text="Tag">
            <Select id="filter-tag" name="tag" defaultValue={filters.tag ?? ""}>
              <option value="">Any tag</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField id="filter-from" text="Saved from">
            <Input id="filter-from" name="from" type="date" defaultValue={filters.from ?? ""} />
          </FilterField>
          <FilterField id="filter-to" text="Saved until">
            <Input id="filter-to" name="to" type="date" defaultValue={filters.to ?? ""} />
          </FilterField>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="submit" className={buttonVariants({ variant: "primary" })}>
            Apply filters
          </button>
          <Link href={action} className={buttonVariants({ variant: "secondary" })}>
            Clear all
          </Link>
        </div>
      </details>
    </form>
  );
}
