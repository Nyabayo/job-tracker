import { expect, test } from "@playwright/test";

const publicPages = ["/", "/login", "/signup", "/forgot-password", "/privacy"];

test.describe("Web security headers and CSP", () => {
  test("every page sends the security headers", async ({ request }) => {
    for (const path of publicPages) {
      const res = await request.get(path);
      const h = res.headers();
      expect(h["content-security-policy"], path).toContain("frame-ancestors 'none'");
      expect(h["content-security-policy"], path).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
      expect(h["x-content-type-options"], path).toBe("nosniff");
      expect(h["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
      expect(h["permissions-policy"], path).toContain("camera=()");
      expect(h["x-powered-by"], path).toBeUndefined();
    }
  });

  test("pages load without Content Security Policy violations", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && /Content Security Policy/i.test(msg.text())) violations.push(msg.text());
    });
    for (const path of publicPages) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
    }
    expect(violations).toEqual([]);
  });

  test("forms submit by POST with a CSRF token, even before scripts load", async ({ page }) => {
    for (const path of ["/login", "/signup", "/forgot-password"]) {
      await page.goto(path);
      const methods = await page.locator("form").evaluateAll((forms) => forms.map((f) => (f as HTMLFormElement).method));
      expect(methods.length, path).toBeGreaterThan(0);
      expect(methods.every((m) => m === "post"), path).toBe(true);
      const tokens = await page.locator('form input[name="csrf_token"]').evaluateAll((inputs) =>
        inputs.map((i) => (i as HTMLInputElement).value),
      );
      expect(tokens.length, `${path}: CSRF token field`).toBe(methods.length);
      expect(tokens.every((t) => t.length === 43), `${path}: CSRF token value`).toBe(true);
    }
  });

  test("a cross-site POST is rejected (CSRF)", async ({ request, baseURL }) => {
    const res = await request.post("/login", {
      headers: { Origin: "https://evil.example", "Content-Type": "application/x-www-form-urlencoded" },
      data: "email=a%40b.c&password=x",
    });
    expect(res.status()).toBe(403);
    const same = await request.post("/api/health", { headers: { Origin: new URL(baseURL ?? "").origin } });
    expect(same.status()).not.toBe(403);
  });
});
