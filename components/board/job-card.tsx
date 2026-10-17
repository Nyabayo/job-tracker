"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Bell, GripVertical, Star } from "lucide-react";
import type { ComponentProps } from "react";
import { label } from "@/lib/board/constants";
import { cn } from "@/lib/utils";

export type BoardCard = {
  id: string;
  stageId: string;
  title: string;
  companyName: string;
  location: string | null;
  workType: string | null;
  excitement: number | null;
  lastActivityAt: Date | string;
  dueSoon: boolean;
};

export function initials(company: string): string {
  const words = company.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function updatedAgo(value: Date | string, now = Date.now()): string {
  const days = Math.floor((now - new Date(value).getTime()) / 86_400_000);
  if (days <= 0) return "Updated today";
  if (days === 1) return "Updated 1 day ago";
  return `Updated ${days} days ago`;
}

export function Stars({ value, className }: { value: number | null; className?: string }) {
  if (!value) return null;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-accent", className)} role="img" aria-label={`Excitement ${value} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} aria-hidden="true" className={cn("size-3.5", i < value ? "fill-current" : "text-border")} />
      ))}
    </span>
  );
}

/** B4: initials circle, title, company, location, work type, rating, last update, due-task bell. */
export function JobCard({
  card,
  handleProps,
  moveMenu,
  dragging,
}: {
  card: BoardCard;
  handleProps?: ComponentProps<"button">;
  moveMenu?: React.ReactNode;
  dragging?: boolean;
}) {
  const meta = [card.location, label(card.workType)].filter(Boolean).join(" · ");
  const href = usePanelHref(card.id);
  return (
    <article
      className={cn(
        "flex flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-surface p-3",
        dragging && "opacity-60 ring-2 ring-primary",
      )}
      aria-label={`${card.title} at ${card.companyName}`}
    >
      <div className="flex items-start gap-2">
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">
          {initials(card.companyName)}
        </span>
        <div className="min-w-0 flex-1">
          <Link href={href} scroll={false} className="block break-words font-bold text-text hover:text-primary hover:underline">
            {card.title}
          </Link>
          <p className="truncate text-sm text-secondary">{card.companyName}</p>
        </div>
        {handleProps ? (
          <button
            type="button"
            className="-mr-1 -mt-1 flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-[var(--radius-control)] text-secondary hover:bg-primary-soft active:cursor-grabbing"
            {...handleProps}
          >
            <GripVertical aria-hidden="true" className="size-5" />
          </button>
        ) : null}
      </div>
      {meta ? <p className="text-sm text-secondary">{meta}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-secondary">
        <Stars value={card.excitement} />
        <span className="inline-flex items-center gap-1">
          {card.dueSoon ? (
            <Bell aria-label="Has a task due soon" role="img" className="size-4 text-danger" />
          ) : null}
          {updatedAgo(card.lastActivityAt)}
        </span>
      </div>
      {moveMenu}
    </article>
  );
}

/** On the board, a card opens the side panel and keeps the filters. */
function usePanelHref(jobId: string): string {
  const pathname = usePathname();
  const params = useSearchParams();
  if (pathname !== "/board") return `/jobs/${jobId}`;
  const q = new URLSearchParams(params.toString());
  q.delete("tab");
  q.delete("followup");
  q.set("job", jobId);
  return `/board?${q.toString()}`;
}
