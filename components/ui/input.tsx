import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "min-h-11 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 text-base text-text placeholder:text-secondary aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  );
}
