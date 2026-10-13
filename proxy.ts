import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, HSTS, isCrossSiteWrite } from "@/lib/security/headers";
import { csrfCookieName, newCsrfToken } from "@/lib/security/csrf-shared";

// Runs before every request (section 7, web security):
// - blocks cross-site state-changing requests (CSRF)
// - sets a per-request nonce Content-Security-Policy, and HSTS over HTTPS
export function proxy(request: NextRequest) {
  const appUrl = process.env.APP_URL;
  const expectedOrigin = appUrl ? new URL(appUrl).origin : request.nextUrl.origin;
  const secure = expectedOrigin.startsWith("https://");

  if (isCrossSiteWrite(request.method, request.headers, expectedOrigin)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, { dev: process.env.NODE_ENV === "development", secure });

  // Give every browser a CSRF token on its first visit; the page rendered
  // for this same request can already read it.
  const csrfName = csrfCookieName(secure);
  const newCsrf = request.cookies.has(csrfName) ? null : newCsrfToken();
  if (newCsrf) request.cookies.set(csrfName, newCsrf);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  if (secure) response.headers.set("Strict-Transport-Security", HSTS);
  if (newCsrf) {
    response.cookies.set(csrfName, newCsrf, { httpOnly: true, secure, sameSite: "lax", path: "/" });
  }
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
