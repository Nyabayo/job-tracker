"use client";

import { CsrfInput } from "@/components/security/csrf";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { useServerForm } from "@/components/auth/use-server-form";
import { deleteAccountSchema } from "@/lib/validation/auth";
import { deleteAccountAction } from "./actions";

export function DeleteAccountForm({ hasPassword, needsCode }: { hasPassword: boolean; needsCode: boolean }) {
  const [open, setOpen] = useState(false);
  const { form, onSubmit, pending, result } = useServerForm(deleteAccountSchema, deleteAccountAction, {
    password: "",
    code: "",
    confirm: "" as "DELETE",
  });
  const { errors } = form.formState;

  if (!open) {
    return (
      <Button variant="danger" onClick={() => setOpen(true)}>
        Delete my account
      </Button>
    );
  }

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-4" aria-label="Confirm account deletion">
      <CsrfInput />
      <Alert tone="danger">
        This can’t be undone. Your jobs, files, contacts, tasks and notes will be permanently deleted, and you’ll be
        logged out everywhere.
      </Alert>
      {result?.message && !result.ok && !result.fieldErrors ? <Alert tone="danger">{result.message}</Alert> : null}
      {hasPassword ? (
        <Field label="Your password" type="password" autoComplete="current-password" required error={errors.password?.message} {...form.register("password")} />
      ) : null}
      {needsCode ? (
        <Field label="Code from your authenticator app" autoComplete="one-time-code" required error={errors.code?.message} {...form.register("code")} />
      ) : null}
      <Field
        label="Type DELETE to confirm"
        autoComplete="off"
        autoCapitalize="characters"
        required
        error={errors.confirm?.message}
        {...form.register("confirm")}
      />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="danger" disabled={pending}>
          {pending ? "Deleting..." : "Permanently delete my account"}
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
