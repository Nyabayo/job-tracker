import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import { buttonVariants } from "@/components/ui/button";
import { currentUser } from "@/lib/auth/session";

const stages = [
  { name: "Wishlist", color: "bg-stage-wishlist" },
  { name: "Applied", color: "bg-stage-applied" },
  { name: "Interview", color: "bg-stage-interview" },
  { name: "Offer", color: "bg-stage-offer" },
  { name: "Rejected", color: "bg-stage-rejected" },
];

export default async function HomePage() {
  if (await currentUser()) redirect("/board");
  return (
    <div className="flex min-h-dvh flex-col pt-safe pb-safe">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-safe py-6 tab:px-8">
        <Logo />
        <Link href="/login" className={buttonVariants({ variant: "ghost" })}>
          Log in
        </Link>
      </header>
      <main id="main" className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-10 px-safe py-12 tab:px-8">
        <div className="flex max-w-2xl flex-col gap-5">
          <h1 className="text-3xl font-extrabold text-text tab:text-4xl">Track every job application on one simple board.</h1>
          <p className="text-lg text-secondary">
            See which CV, cover letter and job board actually get you interviews. Free forever, open source, and your
            data is private to you.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/signup" className={buttonVariants({ size: "lg" })}>
              Create free account
            </Link>
            <Link href="/login" className={buttonVariants({ variant: "secondary", size: "lg" })}>
              Log in
            </Link>
          </div>
        </div>
        <ul aria-label="Board stages" className="flex flex-wrap gap-2">
          {stages.map((s) => (
            <li key={s.name} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border bg-surface px-3 text-sm font-medium text-text">
              <span aria-hidden="true" className={`size-2.5 rounded-full ${s.color}`} />
              {s.name}
            </li>
          ))}
        </ul>
        <section aria-label="Run it yourself" className="max-w-2xl rounded-[var(--radius-panel)] bg-panel p-6 text-on-panel">
          <h2 className="text-xl font-bold text-accent">Run your own private copy</h2>
          <p className="mt-2 text-sm opacity-90">One Docker command starts the whole app on your own server. No paid services, no trackers.</p>
        </section>
      </main>
      <footer className="mx-auto w-full max-w-5xl px-safe py-6 text-sm text-secondary tab:px-8">
        <Link href="/privacy" className="inline-flex min-h-11 items-center underline underline-offset-2">
          Privacy
        </Link>
      </footer>
    </div>
  );
}
