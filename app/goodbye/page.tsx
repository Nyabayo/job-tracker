import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Account deleted" };

export default function GoodbyePage() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-safe py-10">
      <Logo />
      <Card className="flex flex-col gap-3 p-6">
        <h1 className="text-2xl font-bold text-text">Your account is deleted</h1>
        <p className="text-secondary">
          You’ve been logged out everywhere. All your jobs, files and notes are being permanently removed, and will be
          gone within 24 hours. Good luck with the search.
        </p>
        <Link href="/" className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-2">
          Back to the home page
        </Link>
      </Card>
    </main>
  );
}
