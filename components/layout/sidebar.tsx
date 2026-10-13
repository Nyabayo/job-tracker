"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import { isActive, primaryNav, secondaryNav, type NavItem } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={item.label}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm font-medium text-secondary transition-colors hover:bg-primary-soft hover:text-text",
        "justify-center lg:justify-start",
        active && "bg-primary-soft text-text",
      )}
    >
      <Icon aria-hidden="true" className="size-5 shrink-0" />
      {/* Tablets show icons only; the label stays available to screen readers. */}
      <span className="sr-only lg:not-sr-only">{item.label}</span>
    </Link>
  );
}

/** Tablet: icon-only rail. Desktop: full sidebar with labels. Hidden on phones. */
export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[76px] shrink-0 flex-col border-r border-border bg-surface tab:flex lg:w-60">
      <div className="flex h-16 items-center justify-center border-b border-border px-3 lg:justify-start lg:px-4">
        <Link href="/board" aria-label="Job Tracker home" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[10px]">
          <Logo compact className="lg:hidden" />
          <Logo className="hidden lg:inline-flex" />
        </Link>
      </div>
      <nav aria-label="Main" className="flex flex-1 flex-col justify-between p-3">
        <ul className="flex flex-col gap-1">
          {primaryNav.map((item) => (
            <li key={item.href}>
              <NavLink item={item} pathname={pathname} />
            </li>
          ))}
        </ul>
        <ul className="flex flex-col gap-1 border-t border-border pt-3">
          {secondaryNav.map((item) => (
            <li key={item.href}>
              <NavLink item={item} pathname={pathname} />
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
