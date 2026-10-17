"use client";

import { CsrfInput } from "@/components/security/csrf";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { useServerForm } from "@/components/auth/use-server-form";
import {
  forgotPasswordAction,
  loginAction,
  oauthLoginAction,
  resendVerificationAction,
  twoFactorLoginAction,
  resetPasswordAction,
  signUpAction,
  verifyEmailAction,
} from "@/app/(auth)/actions";
import {
  forgotPasswordSchema,
  loginSchema,
  PASSWORD_MIN,
  resendVerificationSchema,
  resetPasswordSchema,
  signUpSchema,
  twoFactorSchema,
  verifyEmailSchema,
} from "@/lib/validation/auth";
import { useState, useTransition } from "react";
import { useCsrfToken } from "@/components/security/csrf";
import { CSRF_FIELD } from "@/lib/security/csrf-shared";
import type { ActionResult } from "@/lib/action-result";

function FormMessage({ result }: { result: { ok: boolean; message?: string } | null }) {
  if (!result?.message) return null;
  return <Alert tone={result.ok ? "success" : "danger"}>{result.message}</Alert>;
}

export function SignUpForm() {
  const { form, onSubmit, pending, result } = useServerForm(signUpSchema, signUpAction, {
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const { errors } = form.formState;
  return (
    <form method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <CsrfInput />
      <FormMessage result={result} />
      <Field label="Name (optional)" autoComplete="name" error={errors.name?.message} {...form.register("name")} />
      <Field label="Email" type="email" autoComplete="email" inputMode="email" required error={errors.email?.message} {...form.register("email")} />
      <Field
        label="Password"
        type="password"
        autoComplete="new-password"
        required
        hint={`At least ${PASSWORD_MIN} characters. A short sentence works well.`}
        error={errors.password?.message}
        {...form.register("password")}
      />
      <Field label="Confirm password" type="password" autoComplete="new-password" required error={errors.confirmPassword?.message} {...form.register("confirmPassword")} />
      <Button type="submit" block size="lg" disabled={pending}>
        {pending ? "Creating your account..." : "Create free account"}
      </Button>
      <p className="text-sm text-secondary">
        By signing up you agree to how we handle your data, explained on our{" "}
        <Link href="/privacy" className="font-semibold text-primary underline underline-offset-2">
          privacy page
        </Link>
        .
      </p>
    </form>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const { form, onSubmit, pending, result } = useServerForm(loginSchema, (v) => loginAction(v, next), {
    email: "",
    password: "",
  });
  const { errors } = form.formState;
  return (
    <form method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <CsrfInput />
      <FormMessage result={result} />
      <Field label="Email" type="email" autoComplete="username" inputMode="email" required error={errors.email?.message} {...form.register("email")} />
      <Field label="Password" type="password" autoComplete="current-password" required error={errors.password?.message} {...form.register("password")} />
      <div className="-mt-1 text-right">
        <Link href="/forgot-password" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-2">
          Forgot your password?
        </Link>
      </div>
      <Button type="submit" block size="lg" disabled={pending}>
        {pending ? "Logging in..." : "Log in"}
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const { form, onSubmit, pending, result } = useServerForm(forgotPasswordSchema, forgotPasswordAction, { email: "" });
  const { errors } = form.formState;
  return (
    <form method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <CsrfInput />
      <FormMessage result={result} />
      <Field label="Email" type="email" autoComplete="email" inputMode="email" required error={errors.email?.message} {...form.register("email")} />
      <Button type="submit" block size="lg" disabled={pending}>
        {pending ? "Sending..." : "Send reset link"}
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const { form, onSubmit, pending, result } = useServerForm(resetPasswordSchema, resetPasswordAction, {
    token,
    password: "",
    confirmPassword: "",
  });
  const { errors } = form.formState;
  return (
    <form method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <CsrfInput />
      <FormMessage result={result} />
      {errors.token?.message ? <Alert tone="danger">{errors.token.message}</Alert> : null}
      <input type="hidden" {...form.register("token")} />
      <Field
        label="New password"
        type="password"
        autoComplete="new-password"
        required
        hint={`At least ${PASSWORD_MIN} characters.`}
        error={errors.password?.message}
        {...form.register("password")}
      />
      <Field label="Confirm new password" type="password" autoComplete="new-password" required error={errors.confirmPassword?.message} {...form.register("confirmPassword")} />
      <Button type="submit" block size="lg" disabled={pending}>
        {pending ? "Saving..." : "Save new password"}
      </Button>
    </form>
  );
}

export function VerifyEmailForm({ token }: { token: string }) {
  const { onSubmit, pending, result } = useServerForm(verifyEmailSchema, verifyEmailAction, { token });
  return (
    <form method="post" onSubmit={onSubmit} className="flex flex-col gap-4">
      <CsrfInput />
      <FormMessage result={result} />
      <Button type="submit" block size="lg" disabled={pending}>
        {pending ? "Confirming..." : "Confirm my email"}
      </Button>
    </form>
  );
}

export function ResendVerificationForm() {
  const { form, onSubmit, pending, result } = useServerForm(resendVerificationSchema, resendVerificationAction, { email: "" });
  const { errors } = form.formState;
  return (
    <form method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <CsrfInput />
      <FormMessage result={result} />
      <Field label="Your email" type="email" autoComplete="email" inputMode="email" required error={errors.email?.message} {...form.register("email")} />
      <Button type="submit" variant="secondary" block disabled={pending}>
        {pending ? "Sending..." : "Send a new link"}
      </Button>
    </form>
  );
}

const PROVIDER_LABEL = { google: "Google", github: "GitHub" } as const;

/** A2: "Continue with Google / GitHub", shown only for configured providers. */
export function OAuthButtons({ providers }: { providers: ("google" | "github")[] }) {
  const csrf = useCsrfToken();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  if (providers.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <FormMessage result={result} />
      {providers.map((provider) => (
        <Button
          key={provider}
          variant="secondary"
          block
          size="lg"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await oauthLoginAction({ provider, [CSRF_FIELD]: csrf });
              if (res && !res.ok) setResult(res);
            })
          }
        >
          Continue with {PROVIDER_LABEL[provider]}
        </Button>
      ))}
      <div className="flex items-center gap-3 text-sm text-secondary" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

/** A4: second login step. */
export function TwoFactorLoginForm() {
  const [recovery, setRecovery] = useState(false);
  const { form, onSubmit, pending, result } = useServerForm(twoFactorSchema, twoFactorLoginAction, { code: "" });
  const { errors } = form.formState;
  return (
    <form method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <CsrfInput />
      <FormMessage result={result} />
      {recovery ? (
        <Field label="Recovery code" autoComplete="off" autoCapitalize="none" spellCheck={false} required error={errors.code?.message} {...form.register("code")} />
      ) : (
        <Field
          label="6-digit code from your authenticator app"
          autoComplete="one-time-code"
          inputMode="numeric"
          maxLength={7}
          required
          error={errors.code?.message}
          {...form.register("code")}
        />
      )}
      <Button type="submit" block size="lg" disabled={pending}>
        {pending ? "Checking..." : "Log in"}
      </Button>
      <button
        type="button"
        className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-primary underline underline-offset-2"
        onClick={() => {
          form.reset({ code: "" });
          setRecovery((r) => !r);
        }}
      >
        {recovery ? "Use a code from my app instead" : "Lost your phone? Use a recovery code"}
      </button>
    </form>
  );
}
