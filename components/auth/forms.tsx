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
  resendVerificationAction,
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
  verifyEmailSchema,
} from "@/lib/validation/auth";

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
