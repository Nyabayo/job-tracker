import "server-only";
import { currentUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db";

/** A9: "light", "dark", or undefined to follow the device. */
export async function currentTheme(): Promise<"light" | "dark" | undefined> {
  const user = await currentUser().catch(() => null);
  if (!user) return undefined;
  const row = await withUser(user.id, (tx) => tx.user.findFirst({ where: { id: user.id }, select: { theme: true } })).catch(() => null);
  if (row?.theme === "LIGHT") return "light";
  if (row?.theme === "DARK") return "dark";
  return undefined;
}
