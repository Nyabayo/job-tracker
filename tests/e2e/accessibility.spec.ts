import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { logIn, signUpAndVerify, uniqueEmail } from "./helpers";

// NFR: at 320, 768, 1440 and 2560 px every screen has no horizontal page
// scroll, touch targets of at least 44px, and no serious or critical axe issues.
const widths = [320, 768, 1440, 2560];
const publicPages = ["/", "/login", "/signup", "/forgot-password", "/check-email?for=signup", "/privacy"];
const appPages = ["/board", "/dashboard", "/tasks", "/archive", "/settings", "/more", "/jobs/new", "/notifications"];

async function checkScreen(page: Page, path: string, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  const label = `${path} @ ${width}px`;

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${label}: horizontal page scroll`).toBeLessThanOrEqual(0);

  // Inline links inside sentences are exempt (WCAG 2.5.8 inline exception).
  const small = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("a, button, input, select, textarea, [role=button]"))
      .filter((el) => el.offsetParent !== null && !el.closest("p") && el.getAttribute("type") !== "hidden")
      .filter((el) => !el.classList.contains("sr-only"))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && (r.height < 44 || r.width < 44))
      .map(({ el, r }) => `${el.tagName.toLowerCase()} "${(el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`),
  );
  expect(small, `${label}: touch targets under 44px`).toEqual([]);

  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`), `${label}: axe`).toEqual([]);
}

test.describe("NFR: responsive and accessible", () => {
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  for (const width of widths) {
    test(`public pages at ${width}px`, async ({ page }) => {
      for (const path of publicPages) await checkScreen(page, path, width);
    });
  }

  test("dark theme passes the same checks", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    for (const path of publicPages) await checkScreen(page, path, 375);
    const email = uniqueEmail("nfr-dark");
    await signUpAndVerify(page, email);
    await logIn(page, email);
    for (const path of appPages) await checkScreen(page, path, 1440);
  });

  test("signed-in pages at every width", async ({ page }) => {
    const email = uniqueEmail("nfr");
    await signUpAndVerify(page, email);
    await logIn(page, email);
    await expect(page).toHaveURL(/\/board$/);
    for (const width of widths) {
      for (const path of appPages) await checkScreen(page, path, width);
    }
  });
});
