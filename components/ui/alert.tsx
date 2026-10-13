import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  info: "border-primary/30 bg-primary-soft text-text",
  success: "border-success/30 bg-success-soft text-text",
  danger: "border-danger/30 bg-danger-soft text-text",
} as const;

/** A message box. Errors are announced immediately; others politely. */
export function Alert({ tone = "info", children, className }: { tone?: keyof typeof tones; children: ReactNode; className?: string }) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      // eslint-disable-next-line security/detect-object-injection -- `tone` is a typed union key
      className={cn("rounded-[var(--radius-control)] border px-4 py-3 text-sm", tones[tone], className)}
    >
      {children}
    </div>
  );
}
