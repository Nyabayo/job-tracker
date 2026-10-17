import { useId, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "min-h-11 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 text-base text-text aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  );
}

type Option = { value: string; label: string };

/** A labelled select with its error linked for screen readers. */
export function SelectField({ label, options, error, placeholder, id, ...props }: ComponentProps<"select"> & { label: string; options: Option[]; error?: string; placeholder?: string }) {
  const generated = useId();
  const selectId = id ?? generated;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-sm font-semibold text-text">
        {label}
      </label>
      <Select id={selectId} aria-invalid={error ? true : undefined} aria-describedby={error ? `${selectId}-error` : undefined} {...props}>
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      {error ? (
        <p id={`${selectId}-error`} className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
