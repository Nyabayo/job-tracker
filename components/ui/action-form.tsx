"use client";

import { createContext, useActionState, useContext, useEffect, useRef, startTransition, type ReactNode } from "react";
import { CsrfInput } from "@/components/security/csrf";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/action-result";

type FormAction = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;

const ResultContext = createContext<{ result: ActionResult | null; pending: boolean }>({ result: null, pending: false });

/** Field error from the last submit, for inputs inside an ActionForm. */
export function useFieldError(name: string): string | undefined {
  return useContext(ResultContext).result?.fieldErrors?.[name]?.[0];
}

export function useFormPending(): boolean {
  return useContext(ResultContext).pending;
}

/**
 * A form posting to a server action with the CSRF token. Submitting through
 * onSubmit keeps what the user typed when the server rejects it; on success
 * the form is cleared (resetOnSuccess) and a toast confirms it.
 */
export function ActionForm({
  action,
  children,
  className,
  label,
  resetOnSuccess = false,
  toastOnSuccess = true,
  onSuccess,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  label: string;
  resetOnSuccess?: boolean;
  toastOnSuccess?: boolean;
  onSuccess?: () => void;
}) {
  const [result, formAction, pending] = useActionState<ActionResult | null, FormData>(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const toast = useToast();
  useEffect(() => {
    if (!result?.ok) return;
    if (resetOnSuccess) ref.current?.reset();
    if (toastOnSuccess && result.message) toast({ message: result.message });
    onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per result
  }, [result]);
  return (
    <ResultContext.Provider value={{ result, pending }}>
      <form
        ref={ref}
        noValidate
        aria-label={label}
        className={className}
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          startTransition(() => formAction(data));
        }}
      >
        <CsrfInput />
        {result && !result.ok && result.message ? <Alert tone="danger">{result.message}</Alert> : null}
        {children}
      </form>
    </ResultContext.Provider>
  );
}
