// CSRF token settings shared by proxy.ts (sets the cookie) and the server
// actions (check it). Double-submit pattern: the token is in a cookie and must
// also come back in the form body. Another site can't read the cookie, so it
// can't forge the body. This sits on top of the Origin check in proxy.ts.

export const CSRF_FIELD = "csrf_token";

/** `__Host-` cookies can't be set or overwritten by any subdomain. */
export function csrfCookieName(secure: boolean): string {
  return secure ? "__Host-jt-csrf" : "jt-csrf";
}

export function newCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

/** Constant-time comparison so the token can't be guessed byte by byte. */
export function tokensMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
