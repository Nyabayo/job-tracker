import type { z } from "zod";

/** What every form server action returns when it doesn't redirect. */
export type ActionResult = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export function invalid(error: z.ZodError): ActionResult {
  const grouped = new Map<string, string[]>();
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    grouped.set(key, [...(grouped.get(key) ?? []), issue.message]);
  }
  return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: Object.fromEntries(grouped) };
}

/** Only allow redirects to paths on this site (no open redirects). */
export function safeNextPath(value: unknown, fallback = "/board"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}
