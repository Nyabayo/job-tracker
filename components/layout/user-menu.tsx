"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { logoutAction } from "@/app/(auth)/actions";
import { CsrfInput } from "@/components/security/csrf";

function initials(name: string | null, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Avatar button with Settings and Log out. Closes on Escape or outside click. */
export function UserMenu({ name, email }: { name: string | null; email: string }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    }
    function onClick(e: MouseEvent) {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
        className="flex size-11 items-center justify-center rounded-full"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-ink text-sm font-semibold text-ground">
          {initials(name, email)}
        </span>
      </button>
      {open ? (
        <div
          id={menuId}
          className="absolute right-0 z-50 mt-2 w-64 rounded-[var(--radius-card)] border border-border bg-surface p-2"
        >
          <div className="border-b border-border px-3 pb-2 pt-1">
            {name ? <p className="truncate text-sm font-semibold text-text">{name}</p> : null}
            <p className="truncate text-sm text-secondary">{email}</p>
          </div>
          <ul className="pt-2">
            <li>
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center rounded-[var(--radius-control)] px-3 text-sm text-text hover:bg-primary-soft"
              >
                Settings
              </Link>
            </li>
            <li>
              <form action={logoutAction}>
              <CsrfInput />
                <button
                  type="submit"
                  className="flex min-h-11 w-full items-center rounded-[var(--radius-control)] px-3 text-left text-sm text-text hover:bg-primary-soft"
                >
                  Log out
                </button>
              </form>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
