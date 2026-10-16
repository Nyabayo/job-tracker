"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useCsrfToken } from "@/components/security/csrf";
import { useToast } from "@/components/ui/toast";
import { CSRF_FIELD } from "@/lib/security/csrf-shared";
import type { ActionResult } from "@/lib/action-result";

/**
 * Runs a server action with the CSRF token, after an inline "are you sure?"
 * step when `confirm` is set (global UX rule for destructive actions).
 */
export function ActionButton({
  action,
  values,
  children,
  confirm,
  variant = "secondary",
  size,
  className,
  label,
  onDone,
}: {
  action: (input: Record<string, unknown>) => Promise<ActionResult>;
  values: Record<string, unknown>;
  children: ReactNode;
  confirm?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "icon";
  className?: string;
  label?: string;
  onDone?: (result: ActionResult) => void;
}) {
  const csrf = useCsrfToken();
  const toast = useToast();
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  const go = () =>
    start(async () => {
      const result = await action({ ...values, [CSRF_FIELD]: csrf });
      setAsking(false);
      if (!result.ok || result.message) toast({ message: result.message ?? "Done.", tone: result.ok ? "info" : "danger" });
      onDone?.(result);
    });

  if (asking && confirm) {
    return (
      <span role="group" aria-label="Confirm" className="inline-flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{confirm}</span>
        <Button variant="danger" onClick={go} disabled={pending}>
          {pending ? "Working..." : "Yes"}
        </Button>
        <Button variant="secondary" onClick={() => setAsking(false)} disabled={pending}>
          Cancel
        </Button>
      </span>
    );
  }
  return (
    <Button variant={variant} size={size} className={className} aria-label={label} disabled={pending} onClick={() => (confirm ? setAsking(true) : go())}>
      {children}
    </Button>
  );
}
