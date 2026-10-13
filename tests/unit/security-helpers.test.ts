import { describe, expect, it } from "vitest";
import { lockoutSeconds, MAX_LOCK_SECONDS } from "@/lib/auth/lockout";
import { generateToken, hashToken, isExpired } from "@/lib/auth/tokens";
import { truncateIp } from "@/lib/ip";
import { escapeHtml } from "@/lib/html";
import { buildCsp, isCrossSiteWrite } from "@/lib/security/headers";
import { invalid, safeNextPath } from "@/lib/action-result";
import { signUpSchema } from "@/lib/validation/auth";

const headers = (h: Record<string, string>) => ({ get: (k: string) => h[k.toLowerCase()] ?? null });

describe("A1: progressive lockout", () => {
  it("allows 4 failures, then locks for 1, 2, 4 ... minutes, capped at an hour", () => {
    expect([0, 1, 4].map(lockoutSeconds)).toEqual([0, 0, 0]);
    expect([5, 6, 7, 8].map(lockoutSeconds)).toEqual([60, 120, 240, 480]);
    expect(lockoutSeconds(50)).toBe(MAX_LOCK_SECONDS);
    expect(lockoutSeconds(Number.NaN)).toBe(0);
  });
});

describe("A3: tokens", () => {
  it("generates 256-bit url-safe tokens and stores only a hash", () => {
    const t = generateToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateToken()).not.toBe(t);
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(t)).not.toContain(t);
  });

  it("treats a token as expired at its expiry time", () => {
    const now = new Date("2026-01-01T10:00:00Z");
    expect(isExpired(new Date("2026-01-01T10:00:00Z"), now)).toBe(true);
    expect(isExpired(new Date("2026-01-01T10:00:01Z"), now)).toBe(false);
  });
});

describe("Privacy: IP truncation", () => {
  it("keeps /24 for IPv4 and /48 for IPv6", () => {
    expect(truncateIp("203.0.113.77")).toBe("203.0.113.0");
    expect(truncateIp("2001:db8:85a3:8d3:1319:8a2e:370:7348")).toBe("2001:db8:85a3::");
    expect(truncateIp("2001:db8::1")).toBe("2001:db8:0::");
    expect(truncateIp("::ffff:198.51.100.9")).toBe("198.51.100.0");
  });

  it("returns null for junk", () => {
    expect(truncateIp("not an ip")).toBeNull();
    expect(truncateIp(null)).toBeNull();
  });
});

describe("Output encoding", () => {
  it("escapes HTML special characters", () => {
    expect(escapeHtml(`<img src=x onerror="alert('1')">&`)).toBe("&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot;&gt;&amp;");
  });
});

describe("Web security: CSP", () => {
  it("uses the nonce, blocks framing and only allows eval in development", () => {
    const prod = buildCsp("abc", { dev: false, secure: true });
    expect(prod).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(prod).toContain("frame-ancestors 'none'");
    expect(prod).toContain("object-src 'none'");
    expect(prod).toContain("upgrade-insecure-requests");
    expect(prod).not.toContain("unsafe-eval");
    expect(buildCsp("abc", { dev: true, secure: false })).toContain("'unsafe-eval'");
  });
});

describe("Web security: CSRF origin check", () => {
  const origin = "https://jobs.example.org";
  it("lets safe methods through", () => {
    expect(isCrossSiteWrite("GET", headers({ origin: "https://evil.test" }), origin)).toBe(false);
  });
  it("blocks writes from another origin, a null origin or a cross-site fetch", () => {
    expect(isCrossSiteWrite("POST", headers({ origin: "https://evil.test" }), origin)).toBe(true);
    expect(isCrossSiteWrite("POST", headers({ origin: "null" }), origin)).toBe(true);
    expect(isCrossSiteWrite("DELETE", headers({ "sec-fetch-site": "cross-site" }), origin)).toBe(true);
    expect(isCrossSiteWrite("POST", headers({ "sec-fetch-site": "same-site" }), origin)).toBe(true);
  });
  it("allows same-origin writes", () => {
    expect(isCrossSiteWrite("POST", headers({ origin }), origin)).toBe(false);
    expect(isCrossSiteWrite("POST", headers({ "sec-fetch-site": "same-origin" }), origin)).toBe(false);
  });
});

describe("Open redirect guard", () => {
  it("only allows paths on this site", () => {
    expect(safeNextPath("/settings")).toBe("/settings");
    expect(safeNextPath("//evil.test")).toBe("/board");
    expect(safeNextPath("/\\evil.test")).toBe("/board");
    expect(safeNextPath("https://evil.test")).toBe("/board");
    expect(safeNextPath(undefined)).toBe("/board");
  });
});

describe("Form errors", () => {
  it("groups Zod issues by field", () => {
    const r = signUpSchema.safeParse({ email: "x", password: "y", confirmPassword: "z" });
    if (r.success) throw new Error("expected failure");
    const out = invalid(r.error);
    expect(out.ok).toBe(false);
    expect(Object.keys(out.fieldErrors ?? {})).toEqual(expect.arrayContaining(["email", "password"]));
  });
});

describe("CSRF double-submit token", () => {
  it("issues long random tokens and compares them exactly", async () => {
    const { newCsrfToken, tokensMatch, csrfCookieName } = await import("@/lib/security/csrf-shared");
    const t = newCsrfToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokensMatch(t, t)).toBe(true);
    expect(tokensMatch(t, newCsrfToken())).toBe(false);
    expect(tokensMatch(t, t.slice(0, -1))).toBe(false);
    expect(tokensMatch("", "")).toBe(false);
    expect(tokensMatch(null, t)).toBe(false);
    expect(csrfCookieName(true)).toBe("__Host-jt-csrf");
  });
});
