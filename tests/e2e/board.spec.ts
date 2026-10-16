import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { logIn, signUpAndVerify, uniqueEmail } from "./helpers";

// Sprint 2 to 4 acceptance tests in a real browser: B2, B3, C1, C2, E1, E1b,
// G2, A5 (files), plus axe and layout checks on a populated board and job.

async function newUser(page: Page, prefix: string): Promise<string> {
  const email = uniqueEmail(prefix);
  await signUpAndVerify(page, email);
  await logIn(page, email);
  await expect(page).toHaveURL(/\/board$/);
  return email;
}

async function addJob(page: Page, title: string, company: string, stage = "Wishlist"): Promise<string> {
  await page.goto("/jobs/new");
  await page.getByLabel("Job title").fill(title);
  await page.getByLabel("Company", { exact: true }).fill(company);
  await page.getByLabel("Stage", { exact: true }).selectOption({ label: stage });
  await page.getByRole("button", { name: "Save job" }).click();
  await expect(page).toHaveURL(/\/jobs\/[0-9a-f-]{36}\?added=1$/);
  return new URL(page.url()).pathname.split("/")[2] as string;
}

function column(page: Page, stage: string) {
  return page.getByRole("region", { name: new RegExp(`^${stage}`) });
}

test.describe("Board and jobs", () => {
  test.describe.configure({ timeout: 120_000 });

  test("C1 + B3: add a job, then Move to on a 375px phone with undo and a follow-up suggestion", async ({ page }) => {
    await newUser(page, "move");
    await addJob(page, "Product Designer", "Acme");
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/board");
    await expect(page.getByRole("tab", { name: "Wishlist (1)" })).toBeVisible();
    await page.getByRole("combobox", { name: /Move Product Designer/ }).selectOption({ label: "Applied" });
    await expect(page.getByText("Moved to Applied.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
    await expect(page.getByText(/Add a follow-up task for/)).toBeVisible();
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("Follow-up added.")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Applied (1)" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("tab", { name: "Applied (1)" })).toBeVisible();
    await page.goto("/tasks");
    await expect(page.getByText("Follow up with Acme").first()).toBeVisible();
  });

  test("B3: undo puts the card back", async ({ page }) => {
    await newUser(page, "undo");
    await addJob(page, "Analyst", "Undo Ltd");
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/board");
    await page.getByRole("combobox", { name: /Move Analyst/ }).selectOption({ label: "Offer" });
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("tab", { name: "Wishlist (1)" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Offer (0)" })).toBeVisible();
  });

  test("B2: keyboard drag from Applied to Interview persists and is on the timeline", async ({ page }) => {
    await newUser(page, "drag");
    const id = await addJob(page, "Backend Engineer", "Drag Co", "Applied");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/board");
    await expect(column(page, "Applied").getByRole("link", { name: "Backend Engineer" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    const handle = page.getByRole("button", { name: "Drag Backend Engineer" });
    await handle.focus();
    await page.keyboard.press("Space");
    await page.waitForTimeout(300); // let the sensor measure the columns
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("Backend Engineer is over Interview.")).toBeAttached();
    await page.keyboard.press("Space");
    await expect(column(page, "Interview").getByRole("link", { name: "Backend Engineer" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(column(page, "Interview").getByRole("link", { name: "Backend Engineer" })).toBeVisible();
    await page.goto(`/jobs/${id}?tab=timeline`);
    await expect(page.getByText("Stage changed")).toBeVisible();
    await expect(page.getByText("Applied to Interview")).toBeVisible();
  });

  test("C2: a private or blocked link shows a clear message and keeps manual entry", async ({ page }) => {
    await newUser(page, "ssrf");
    await page.goto("/jobs/new");
    for (const url of ["http://127.0.0.1:3000/", "http://169.254.169.254/latest/meta-data/", "http://localhost/admin"]) {
      await page.getByLabel("Paste a job link").fill(url);
      await page.getByRole("button", { name: "Fill in from link" }).click();
      await expect(page.getByText(/You can still fill in the details by hand below/)).toBeVisible();
    }
    await expect(page.getByLabel("Job title")).toBeEditable();
  });

  test("E1, E1b, A5: upload a 2 MB PDF, reject a fake PDF, and only the owner can download it", async ({ page, browser }) => {
    await newUser(page, "files");
    const id = await addJob(page, "Teacher", "School");
    await page.goto(`/jobs/${id}?tab=documents`);
    const pdf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(2 * 1024 * 1024 - 9, 0x20)]);
    await page.getByLabel("File", { exact: true }).setInputFiles({ name: "My CV.pdf", mimeType: "application/pdf", buffer: pdf });
    await page.getByRole("button", { name: "Upload file" }).click();
    await expect(page.getByText("My CV.pdf")).toBeVisible();
    await expect(page.getByText(/CV · 2\.0 MB/)).toBeVisible();
    await expect(page.getByText("Virus-checked")).toBeVisible();

    await page.getByLabel("File", { exact: true }).setInputFiles({ name: "invoice.pdf", mimeType: "application/pdf", buffer: Buffer.from("MZ\x90\x00 this is really an exe") });
    await page.getByRole("button", { name: "Upload file" }).click();
    await expect(page.getByText("Only PDF, Word (.docx), PNG and JPG files can be uploaded.")).toBeVisible();
    await expect(page.getByText("invoice.pdf", { exact: true })).toHaveCount(0);

    const big = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(10 * 1024 * 1024 + 10, 0x20)]);
    await page.getByLabel("File", { exact: true }).setInputFiles({ name: "huge.pdf", mimeType: "application/pdf", buffer: big });
    await expect(page.getByText("That file is too big. The limit is 10 MB.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Upload file" })).toBeDisabled();
    await expect(page.getByText("huge.pdf", { exact: true })).toHaveCount(0);

    const href = await page.getByRole("link", { name: "Download My CV.pdf" }).getAttribute("href");
    const own = await page.request.get(href as string);
    expect(own.status()).toBe(200);
    expect(own.headers()["content-disposition"]).toContain("attachment");
    expect((await own.body()).subarray(0, 5).toString()).toBe("%PDF-");

    const other = await browser.newPage();
    await newUser(other, "files-other");
    expect((await other.request.get(href as string)).status()).toBe(404);
    expect((await other.goto(`/jobs/${id}`))?.status()).toBe(404);
    await other.close();
  });

  test("job details: notes, contacts and links; XSS stays as text", async ({ page }) => {
    await newUser(page, "details");
    const id = await addJob(page, "Nurse", "Clinic");
    await page.goto(`/jobs/${id}?tab=notes`);
    await page.getByRole("textbox", { name: "New note" }).fill('<img src=x onerror="window.pwned=1">Call back Monday');
    await page.getByRole("button", { name: "Add note" }).click();
    await expect(page.getByText('<img src=x onerror="window.pwned=1">Call back Monday')).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { pwned?: number }).pwned)).toBeUndefined();

    await page.goto(`/jobs/${id}?tab=contacts`);
    await page.getByLabel("Name", { exact: true }).fill("Amina Otieno");
    await page.getByLabel("Email", { exact: true }).fill("amina@clinic.test");
    await page.getByRole("button", { name: "Add contact" }).click();
    await expect(page.getByRole("heading", { name: "Amina Otieno" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Email" })).toHaveAttribute("href", "mailto:amina@clinic.test");

    await page.goto(`/jobs/${id}`);
    await page.getByLabel("Name", { exact: true }).fill("Careers");
    await page.getByLabel("Link", { exact: true }).fill("javascript:alert(1)");
    await page.getByRole("button", { name: "Add link" }).click();
    await expect(page.getByText("Enter a full link that starts with https://")).toBeVisible();
  });

  test("D9 + section 5: rich text notes, and the job opens in a side panel from the board", async ({ page }) => {
    await newUser(page, "panel");
    const id = await addJob(page, "Analyst", "Bank");
    await page.goto(`/jobs/${id}?tab=notes`);
    const editor = page.getByRole("textbox", { name: "New note" });
    await editor.click();
    await page.getByRole("button", { name: "Bold" }).click();
    await page.keyboard.type("Salary");
    await page.getByRole("button", { name: "Bold" }).click();
    await page.keyboard.type(" is negotiable");
    await page.getByRole("button", { name: "Add note" }).click();
    await expect(page.locator("strong", { hasText: "Salary" })).toBeVisible();
    await expect(editor).toHaveText("");

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/board");
    await page.getByRole("link", { name: "Analyst" }).click();
    await expect(page).toHaveURL(new RegExp(`/board\\?job=${id}$`));
    const panel = page.getByRole("complementary", { name: "Job details" });
    await expect(panel.getByRole("heading", { name: "Analyst" })).toBeVisible();
    await panel.getByRole("link", { name: /^notes/i }).click();
    await expect(panel.locator("strong", { hasText: "Salary" })).toBeVisible();
    await expect(column(page, "Wishlist")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/board$/);
    await expect(panel).toHaveCount(0);
  });

  test("NFR: populated board and job page pass axe with no page scroll", async ({ page }) => {
    await newUser(page, "nfr-board");
    const id = await addJob(page, "Accessible Engineer with a very long job title that wraps", "A11y Co", "Interview");
    await addJob(page, "Second", "Other");
    for (const width of [320, 768, 1440, 2560]) {
      for (const path of ["/board", `/board?job=${id}`, `/jobs/${id}`, `/jobs/${id}?tab=tasks`, `/jobs/${id}?tab=documents`, "/dashboard"]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${path} @ ${width}`).toBeLessThanOrEqual(0);
        const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`), `${path} @ ${width}`).toEqual([]);
      }
    }
  });
});
