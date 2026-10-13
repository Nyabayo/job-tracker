"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { bottomTabs, isActive } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

/** Phones only: Board, Dashboard, Tasks, More. Sits above the home indicator. */
export function BottomTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-safe tab:hidden"
    >
      <ul className="grid grid-cols-4">
        {bottomTabs.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium text-secondary",
                  active && "text-primary",
                )}
              >
                <Icon aria-hidden="true" className="size-5" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
