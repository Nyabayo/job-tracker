import { useId, type ComponentProps, type ReactNode } from "react";
import { Input } from "@/components/ui/input";

type FieldProps = ComponentProps<"input"> & {
  label: string;
  error?: string;
  hint?: ReactNode;
};

/** A labelled input with its hint and error linked for screen readers. */
export function Field({ label, error, hint, id, ...inputProps }: FieldProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-semibold text-text">
        {label}
      </label>
      <Input id={inputId} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...inputProps} />
      {hint ? (
        <p id={hintId} className="text-sm text-secondary">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
