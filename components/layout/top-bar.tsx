import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { UserMenu } from "@/components/layout/user-menu";

/** Phones: logo and avatar. Desktop: search, notifications and avatar. */
export function TopBar({ name, email, unread }: { name: string | null; email: string; unread: number }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface pt-safe">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between gap-3 px-safe tab:px-6">
        <Link href="/board" aria-label="Job Tracker home" className="inline-flex min-h-11 items-center rounded-[10px] tab:hidden">
          <Logo />
        </Link>
        <form role="search" action="/board" className="hidden max-w-md flex-1 lg:block">
          <label htmlFor="global-search" className="sr-only">
            Search jobs
          </label>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-secondary" />
            <input
              id="global-search"
              name="q"
              type="search"
              placeholder="Search jobs and companies"
              className="min-h-11 w-full rounded-[var(--radius-control)] border border-border bg-ground pl-9 pr-3 text-sm text-text placeholder:text-secondary"
            />
          </div>
        </form>
        <div className="ml-auto flex items-center gap-1">
          <Link
            href="/notifications"
            aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
            className="relative flex size-11 items-center justify-center rounded-[var(--radius-control)] text-secondary hover:bg-primary-soft hover:text-text"
          >
            <Bell aria-hidden="true" className="size-5" />
            {unread > 0 ? (
              <span aria-hidden="true" className="absolute right-1 top-1 min-w-5 rounded-[var(--radius-chip)] bg-danger px-1 text-center text-xs font-bold text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </Link>
          <UserMenu name={name} email={email} />
        </div>
      </div>
    </header>
  );
}
