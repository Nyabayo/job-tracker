import "server-only";
import { cookies } from "next/headers";
import { isSecureUrl } from "@/lib/env";
import { CSRF_FIELD, csrfCookieName, tokensMatch } from "@/lib/security/csrf-shared";

/** This browser's CSRF token, set by proxy.ts on its first request. */
export async function csrfToken(): Promise<string> {
  return (await cookies()).get(csrfCookieName(isSecureUrl()))?.value ?? "";
}

function submitted(input: unknown): string | null {
  if (input instanceof FormData) {
    const value = input.get(CSRF_FIELD);
    return typeof value === "string" ? value : null;
  }
  if (input && typeof input === "object") {
    const value: unknown = Object.getOwnPropertyDescriptor(input, CSRF_FIELD)?.value;
    return typeof value === "string" ? value : null;
  }
  return null;
}

/** True when the submitted token matches the cookie. Check first in every server action. */
export async function csrfValid(input: unknown): Promise<boolean> {
  return tokensMatch(submitted(input), await csrfToken());
}

export const CSRF_FAILED = {
  ok: false,
  message: "This page has expired. Refresh the page and try again.",
} as const;
