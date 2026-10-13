import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { logoutAction } from "@/app/(auth)/actions";
import { CsrfInput } from "@/components/security/csrf";
import { Archive, Settings, ShieldCheck } from "lucide-react";

export const metadata: Metadata = { title: "More" };

const links = [
  { href: "/archive", label: "Archive", icon: Archive },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/privacy", label: "Privacy", icon: ShieldCheck },
];

/** Phones: everything that doesn't fit in the bottom tab bar. */
export default function MorePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="More" />
      <Card>
        <ul className="divide-y divide-border">
          {links.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className="flex min-h-14 items-center gap-3 px-4 text-text">
                <Icon aria-hidden="true" className="size-5 text-secondary" />
                <span className="flex-1 font-medium">{label}</span>
                <ChevronRight aria-hidden="true" className="size-5 text-secondary" />
              </Link>
            </li>
          ))}
          <li>
            <form action={logoutAction}>
              <CsrfInput />
              <button type="submit" className="flex min-h-14 w-full items-center px-4 text-left font-medium text-danger">
                Log out
              </button>
            </form>
          </li>
        </ul>
      </Card>
    </div>
  );
}
