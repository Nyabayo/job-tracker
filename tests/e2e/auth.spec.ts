import { expect, test } from "@playwright/test";
import { linkFromEmail, localPath, logIn, PASSWORD, signUpAndVerify, uniqueEmail } from "./helpers";

test.describe("A1 + A3: accounts", () => {
  test("sign up, confirm email, log in and log out", async ({ page }) => {
    const email = uniqueEmail("a1");
    await signUpAndVerify(page, email);
    await logIn(page, email);
    await expect(page).toHaveURL(/\/board$/);
    await expect(page.getByRole("heading", { name: "Board", level: 1 })).toBeVisible();

    await page.goto("/more");
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/board");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("an unconfirmed email can't log in", async ({ page }) => {
    const email = uniqueEmail("a3-unverified");
    await page.goto("/signup");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Confirm password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create free account" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

    await logIn(page, email);
    await expect(page.getByText("Please confirm your email first")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("wrong password and unknown email get the same message", async ({ page }) => {
    const email = uniqueEmail("a1-generic");
    await signUpAndVerify(page, email);

    await logIn(page, email, "not the right password");
    const wrongPassword = await page.locator("main [role=alert]").textContent();
    await logIn(page, uniqueEmail("nobody"), "not the right password");
    const unknownEmail = await page.locator("main [role=alert]").textContent();
    expect(wrongPassword).toBe(unknownEmail);
  });

  test("reset a forgotten password; the link works only once", async ({ page }) => {
    const email = uniqueEmail("a3-reset");
    await signUpAndVerify(page, email);

    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

    const link = localPath(await linkFromEmail(email, "Reset your"));
    const newPassword = "a brand new long password";
    await page.goto(link);
    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm new password").fill(newPassword);
    await page.getByRole("button", { name: "Save new password" }).click();
    await expect(page.getByText("Your password was changed")).toBeVisible();

    await logIn(page, email, newPassword);
    await expect(page).toHaveURL(/\/board$/);

    // Reusing the link fails.
    await page.context().clearCookies();
    await page.goto(link);
    await page.getByLabel("New password", { exact: true }).fill("yet another long password");
    await page.getByLabel("Confirm new password").fill("yet another long password");
    await page.getByRole("button", { name: "Save new password" }).click();
    await expect(page.getByText("expired or was already used")).toBeVisible();
  });
});

test.describe("A7: delete account", () => {
  test("after confirming, the user is logged out and can't log in again", async ({ page }) => {
    const email = uniqueEmail("a7");
    await signUpAndVerify(page, email);
    await logIn(page, email);
    await expect(page).toHaveURL(/\/board$/);

    await page.goto("/settings");
    await page.getByRole("button", { name: "Delete my account" }).click();
    await page.getByLabel("Your password").fill(PASSWORD);
    await page.getByLabel("Type DELETE to confirm").fill("DELETE");
    await page.getByRole("button", { name: "Permanently delete my account" }).click();
    await expect(page.getByRole("heading", { name: "Your account is deleted" })).toBeVisible();

    await page.goto("/board");
    await expect(page).toHaveURL(/\/login$/);
    await logIn(page, email);
    await expect(page.locator("main [role=alert]")).toContainText("don't match an account");
  });
});
