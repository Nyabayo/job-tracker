import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ResendVerificationForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Check your email" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function CheckEmailPage({ searchParams }: Props) {
  const { for: reason } = await searchParams;
  if (reason === "reset") {
    return (
      <AuthCard
        title="Check your email"
        intro="If an account uses that address, we've sent a link to reset your password. It works once, for 30 minutes."
        footer={
          <Link href="/login" className="font-semibold text-primary underline underline-offset-2">
            Back to log in
          </Link>
        }
      >
        <p className="text-sm text-secondary">Can’t find it? Check your spam folder, or request another link in a few minutes.</p>
      </AuthCard>
    );
  }
  return (
    <AuthCard
      title="Check your email"
      intro="We've sent you a link to confirm your email address. Open it to finish creating your account."
      footer={
        <Link href="/login" className="font-semibold text-primary underline underline-offset-2">
          Back to log in
        </Link>
      }
    >
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text">Didn’t get it?</h2>
        <p className="text-sm text-secondary">Check your spam folder, or enter your email and we’ll send a new link.</p>
        <ResendVerificationForm />
      </div>
    </AuthCard>
  );
}
