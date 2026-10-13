import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/forms";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Choose a new password", referrer: "no-referrer" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token } = await searchParams;
  return (
    <AuthCard
      title="Choose a new password"
      intro="After saving, you'll be logged out on every device and can log in with the new password."
      footer={
        <Link href="/forgot-password" className="font-semibold text-primary underline underline-offset-2">
          Request a new link
        </Link>
      }
    >
      {typeof token === "string" ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Alert tone="danger">This reset link is missing its code. Request a new one.</Alert>
      )}
    </AuthCard>
  );
}
