import { Archive, SquareCheck, ChartColumn, Ellipsis, SquareKanban, Settings, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const primaryNav: NavItem[] = [
  { href: "/board", label: "Board", icon: SquareKanban },
  { href: "/dashboard", label: "Dashboard", icon: ChartColumn },
  { href: "/tasks", label: "Tasks", icon: SquareCheck },
  { href: "/archive", label: "Archive", icon: Archive },
];

export const secondaryNav: NavItem[] = [{ href: "/settings", label: "Settings", icon: Settings }];

/** Phones: four tabs at the bottom (section 5). */
export const bottomTabs: NavItem[] = [
  { href: "/board", label: "Board", icon: SquareKanban },
  { href: "/dashboard", label: "Dashboard", icon: ChartColumn },
  { href: "/tasks", label: "Tasks", icon: SquareCheck },
  { href: "/more", label: "More", icon: Ellipsis },
];

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
