"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";

/**
 * Section 5: the job opens in a right-hand panel over the board on desktop,
 * and as a full-screen sheet on phones. Escape closes it.
 */
export function SidePanel({ label, closeHref, children }: { label: string; closeHref: string; children: ReactNode }) {
  const router = useRouter();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) router.push(closeHref, { scroll: false });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeHref, router]);
  return (
    <aside
      ref={ref}
      tabIndex={-1}
      aria-label={label}
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-ground px-4 pb-10 pt-4 outline-none tab:inset-y-0 tab:left-auto tab:right-0 tab:w-[min(46rem,100%)] tab:border-l tab:border-border tab:px-6 tab:shadow-2xl"
    >
      {children}
    </aside>
  );
}
