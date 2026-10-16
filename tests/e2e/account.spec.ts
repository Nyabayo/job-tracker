import { expect, test } from "@playwright/test";
import { generate } from "otplib";
import { logIn, signUpAndVerify, uniqueEmail } from "./helpers";

// A4 two-factor login and A6 ZIP export in a real browser.

test.describe("Account security and export", () => {
  test.describe.configure({ timeout: 120_000 });

  test("A4: turn on two-factor, then log in with a code, then with a recovery code", async ({ page }) => {
    const email = uniqueEmail("tfa");
    await signUpAndVerify(page, email);
    await logIn(page, email);
    await expect(page).toHaveURL(/\/board$/);

    await page.goto("/settings");
    await page.getByRole("button", { name: "Set up two-factor login" }).click();
    const secret = ((await page.locator("code").first().textContent()) ?? "").replace(/\s/g, "");
    expect(secret).toMatch(/^[A-Z2-7]{16,}$/);
    await page.getByLabel("6-digit code").fill("000000");
    await page.getByRole("button", { name: "Turn on" }).click();
    await expect(page.getByText("That code isn't right")).toBeVisible();
    await page.getByLabel("6-digit code").fill(await generate({ secret }));
    await page.getByRole("button", { name: "Turn on" }).click();
    const items = page.getByRole("list", { name: "Recovery codes" }).getByRole("listitem");
    await expect(items).toHaveCount(10);
    const codes = await items.allTextContents();
    await page.getByRole("button", { name: "I've saved them" }).click();
    await expect(page.getByText("Two-factor login is on")).toBeVisible();

    // The password alone no longer starts a session.
    await page.context().clearCookies();
    await logIn(page, email);
    await expect(page).toHaveURL(/\/login\/two-factor$/);
    expect((await page.goto("/board"))?.url()).toMatch(/\/login/);

    await logIn(page, email);
    await page.getByLabel("6-digit code from your authenticator app").fill(await generate({ secret, epoch: Math.floor(Date.now() / 1000) + 30 }));
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/board$/);

    await page.context().clearCookies();
    await logIn(page, email);
    await page.getByRole("button", { name: "Lost your phone? Use a recovery code" }).click();
    await page.getByLabel("Recovery code").fill(codes[0]!);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/board$/);

    // A used recovery code doesn't work twice.
    await page.context().clearCookies();
    await logIn(page, email);
    await page.getByRole("button", { name: "Lost your phone? Use a recovery code" }).click();
    await page.getByLabel("Recovery code").fill(codes[0]!);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("That code isn't right")).toBeVisible();
  });

  test("A6: the ZIP export has my data and files, and needs a session", async ({ page, request }) => {
    const email = uniqueEmail("zip");
    await signUpAndVerify(page, email);
    await logIn(page, email);
    await expect(page).toHaveURL(/\/board$/);
    await page.goto("/jobs/new");
    await page.getByLabel("Job title").fill("Pilot");
    await page.getByLabel("Company", { exact: true }).fill("Airline");
    await page.getByRole("button", { name: "Save job" }).click();
    await expect(page).toHaveURL(/\?added=1$/);
    await page.getByRole("link", { name: /^documents/i }).click();
    const pdf = Buffer.from("%PDF-1.4\nhello zip\n");
    await page.getByLabel("File", { exact: true }).setInputFiles({ name: "Licence.pdf", mimeType: "application/pdf", buffer: pdf });
    await page.getByRole("button", { name: "Upload file" }).click();
    await expect(page.getByText("Licence.pdf")).toBeVisible();

    const res = await page.request.get("/api/export?format=zip");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("application/zip");
    const body = await res.body();
    expect(body.subarray(0, 4).toString("hex")).toBe("504b0304");
    expect(body.includes(Buffer.from("data.json"))).toBe(true);
    expect(body.includes(Buffer.from("jobs.csv"))).toBe(true);
    expect(body.includes(Buffer.from("-Licence.pdf"))).toBe(true);
    expect(body.includes(pdf)).toBe(true);

    expect((await request.get("/api/export?format=zip")).status()).toBe(404);
  });
});
