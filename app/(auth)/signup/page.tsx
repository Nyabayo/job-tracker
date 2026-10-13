import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Sign up" };

export default function SignUpPage() {
  return (
    <AuthCard
      title="Create your free account"
      intro="Track every application on one board. Your data stays private to you."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-primary underline underline-offset-2">
            Log in
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthCard>
  );
}
