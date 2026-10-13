"use client";

import { createContext, useContext, type ReactNode } from "react";
import { CSRF_FIELD } from "@/lib/security/csrf-shared";

const CsrfContext = createContext("");

export function CsrfProvider({ token, children }: { token: string; children: ReactNode }) {
  return <CsrfContext.Provider value={token}>{children}</CsrfContext.Provider>;
}

export function useCsrfToken(): string {
  return useContext(CsrfContext);
}

/** Hidden field carrying the CSRF token; put one in every form. */
export function CsrfInput() {
  return <input type="hidden" name={CSRF_FIELD} value={useCsrfToken()} />;
}
