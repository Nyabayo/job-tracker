import { cn } from "@/lib/utils";

/** Wordmark: an ink square with "JT" and the product name. */
export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-ink font-heading text-sm font-bold text-ground"
      >
        JT
      </span>
      <span className={cn("font-heading text-lg font-bold tracking-tight text-text", compact && "sr-only")}>Job Tracker</span>
    </span>
  );
}
