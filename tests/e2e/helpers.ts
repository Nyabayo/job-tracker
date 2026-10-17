import { expect, type Page } from "@playwright/test";

const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

export const PASSWORD = "correct horse battery staple";

type MailSummary = { ID: string; Subject: string };

/** Waits for an email to `to` whose subject contains `subject`, returns the first link in it. */
export async function linkFromEmail(to: string, subject: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const body = (await res.json()) as { messages: MailSummary[] };
    const match = body.messages.find((m) => m.Subject.includes(subject));
    if (match) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${match.ID}`)).json()) as { Text: string };
      const link = /(https?:\/\/\S+)/.exec(msg.Text)?.[1];
      if (link) return link;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No "${subject}" email for ${to}`);
}

/** Opens a link from an email on whatever host the test is using. */
export function localPath(link: string): string {
  const url = new URL(link);
  return `${url.pathname}${url.search}`;
}

export async function signUpAndVerify(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create free account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  const link = await linkFromEmail(email, "Confirm your email");
  await page.goto(localPath(link));
  await page.getByRole("button", { name: "Confirm my email" }).click();
  await expect(page.getByText("Your email is confirmed")).toBeVisible();
}

export async function logIn(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}
