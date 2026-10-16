import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { TwoFactorLoginForm } from "@/components/auth/forms";
import { readTicket } from "@/lib/auth/two-factor";

export const metadata: Metadata = { title: "Two-factor login" };

export default async function TwoFactorPage() {
  if (!(await readTicket())) redirect("/login");
  return (
    <AuthCard
      title="Enter your code"
      intro="Open your authenticator app and enter the code for Job Tracker."
      footer={
        <Link href="/login" className="font-semibold text-primary underline underline-offset-2">
          Start again
        </Link>
      }
    >
      <TwoFactorLoginForm />
    </AuthCard>
  );
}
