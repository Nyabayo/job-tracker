"use client";

import { useState, useTransition } from "react";
import { useForm, type DefaultValues, type FieldValues, type Path, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { useCsrfToken } from "@/components/security/csrf";
import { CSRF_FIELD } from "@/lib/security/csrf-shared";

/**
 * react-hook-form + the shared Zod schema in the browser, then the server
 * action, which validates again with the same schema (rule 4). Server field
 * errors are shown on the matching inputs.
 */
export function useServerForm<S extends z.ZodType<FieldValues, FieldValues>>(
  schema: S,
  action: (values: z.output<S> & { [CSRF_FIELD]: string }) => Promise<ActionResult | void>,
  defaultValues: DefaultValues<z.input<S>>,
) {
  const form = useForm<z.input<S>, unknown, z.output<S>>({
    // zodResolver's generics can't follow a generic schema type; the cast
    // restates the same input/output types.
    resolver: zodResolver(schema) as unknown as Resolver<z.input<S>, unknown, z.output<S>>,
    defaultValues,
    mode: "onTouched",
  });
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const csrf = useCsrfToken();

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      const res = await action({ ...values, [CSRF_FIELD]: csrf });
      if (!res) return;
      setResult(res);
      for (const [key, messages] of Object.entries(res.fieldErrors ?? {})) {
        if (messages?.[0]) form.setError(key as Path<z.input<S>>, { message: messages[0] });
      }
    });
  });

  return { form, onSubmit, pending, result };
}
