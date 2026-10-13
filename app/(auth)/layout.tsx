import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import { currentUser } from "@/lib/auth/session";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await currentUser()) redirect("/board");
  return (
    <div className="flex min-h-dvh flex-col pt-safe pb-safe">
      <header className="mx-auto flex w-full max-w-md items-center px-safe py-6">
        <Link href="/" aria-label="Job Tracker home" className="inline-flex min-h-11 items-center rounded-[10px]">
          <Logo />
        </Link>
      </header>
      <main id="main" className="mx-auto w-full max-w-md flex-1 px-safe pb-10">
        {children}
      </main>
      <footer className="mx-auto w-full max-w-md px-safe py-6 text-sm text-secondary">
        <Link href="/privacy" className="inline-flex min-h-11 items-center underline underline-offset-2">
          Privacy
        </Link>
      </footer>
    </div>
  );
}
