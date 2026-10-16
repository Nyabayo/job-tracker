import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm, OAuthButtons } from "@/components/auth/forms";
import { oauthProviders } from "@/lib/env";
import { Alert } from "@/components/ui/alert";
import { safeNextPath } from "@/lib/action-result";

export const metadata: Metadata = { title: "Log in" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  return (
    <AuthCard
      title="Welcome back"
      intro="Log in to see your board."
      footer={
        <>
          New here?{" "}
          <Link href="/signup" className="font-semibold text-primary underline underline-offset-2">
            Create a free account
          </Link>
        </>
      }
    >
      {params.verified ? <Alert tone="success">Your email is confirmed. You can log in now.</Alert> : null}
      {params.reset ? <Alert tone="success">Your password was changed. Log in with your new password.</Alert> : null}
      {params.error ? <Alert tone="danger">{oauthError(params.error)}</Alert> : null}
      <OAuthButtons providers={oauthProviders()} />
      <LoginForm next={next} />
    </AuthCard>
  );
}

function oauthError(code: string | string[]): string {
  if (code === "OAuthAccountNotLinked") {
    return "That email already has an account here. Log in with your password, or reset it if you've forgotten it.";
  }
  if (code === "AccessDenied") return "That account can't sign in.";
  return "We couldn't sign you in with that provider. Please try again.";
}
