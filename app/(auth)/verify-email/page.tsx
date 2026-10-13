import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { ResendVerificationForm, VerifyEmailForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Confirm your email", referrer: "no-referrer" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// The link only opens this page. Confirming takes a button press, so email
// scanners that pre-open links can't use up the token.
export default async function VerifyEmailPage({ searchParams }: Props) {
  const { token } = await searchParams;
  return (
    <AuthCard title="Confirm your email" intro="One last step. Press the button to confirm this is your email address.">
      {typeof token === "string" ? <VerifyEmailForm token={token} /> : null}
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <h2 className="text-lg font-semibold text-text">Link not working?</h2>
        <ResendVerificationForm />
      </div>
    </AuthCard>
  );
}
