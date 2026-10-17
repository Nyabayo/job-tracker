import { useId, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function TextareaField({ label, error, id, className, ...props }: ComponentProps<"textarea"> & { label: string; error?: string }) {
  const generated = useId();
  const areaId = id ?? generated;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={areaId} className="text-sm font-semibold text-text">
        {label}
      </label>
      <textarea
        id={areaId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${areaId}-error` : undefined}
        className={cn(
          "min-h-28 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-base text-text placeholder:text-secondary aria-[invalid=true]:border-danger",
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={`${areaId}-error`} className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
