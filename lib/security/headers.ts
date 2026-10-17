// Pure helpers used by proxy.ts. Kept free of Next.js imports so they are
// easy to unit test.

export function buildCsp(nonce: string, opts: { dev: boolean; secure: boolean }): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${opts.dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
  ];
  if (opts.secure) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

export const HSTS = "max-age=63072000; includeSubDomains; preload";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence for every state-changing request: a browser always sends Origin
 * or Sec-Fetch-Site on POST/PUT/PATCH/DELETE, and it must say the request came
 * from this site. Requests with neither header are not from a browser, so
 * they can't carry a victim's cookies by accident.
 */
export function isCrossSiteWrite(
  method: string,
  headers: { get(name: string): string | null },
  expectedOrigin: string,
): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return false;
  const origin = headers.get("origin");
  if (origin && origin !== "null") return origin !== expectedOrigin;
  if (origin === "null") return true;
  const site = headers.get("sec-fetch-site");
  if (site) return site !== "same-origin" && site !== "none";
  return false;
}
