// Test cases for job-tracker.yaml (`semgrep --test .semgrep`). Not app code:
// excluded from tsconfig and ESLint.

// ---- server-action-missing-csrf-check / app-action-missing-require-user ----

// ok: server-action-missing-csrf-check, app-action-missing-require-user
export async function goodAction(input: unknown) {
  const user = await requireUser();
  if (!(await csrfValid(input))) return CSRF_FAILED;
  return save(user, input);
}

// ok: server-action-missing-csrf-check
export async function goodFormAction(formData: FormData) {
  if (!(await csrfValid(formData))) redirect("/settings");
  await requireUser();
  await endSession();
}

// ruleid: server-action-missing-csrf-check
export async function forgotCsrf(input: unknown) {
  const user = await requireUser();
  return save(user, input);
}

// ruleid: server-action-missing-csrf-check
export async function checkedButIgnored(input: unknown) {
  const user = await requireUser();
  await csrfValid(input);
  return save(user, input);
}

// ruleid: app-action-missing-require-user
export async function forgotAuth(input: unknown) {
  if (!(await csrfValid(input))) return CSRF_FAILED;
  return save(null, input);
}

// Not exported, so not a server action.
// ok: server-action-missing-csrf-check, app-action-missing-require-user
async function helper(input: unknown) {
  return save(null, input);
}

// ---- prisma-raw-unsafe ----
async function sql(tx: Tx, id: string, table: string) {
  // ok: prisma-raw-unsafe
  await tx.$executeRaw`SELECT set_config('app.user_id', ${id}, true)`;
  // ok: prisma-raw-unsafe
  await tx.$queryRaw<{ exists: boolean }[]>`SELECT row_exists(${table}, ${id}::uuid)`;
  // ruleid: prisma-raw-unsafe
  await tx.$queryRawUnsafe(`SELECT * FROM ${table} WHERE id = '${id}'`);
  // ruleid: prisma-raw-unsafe
  await tx.$executeRawUnsafe("DELETE FROM jobs WHERE id = " + id);
}

// ---- dangerously-set-inner-html ----
function Note({ html, text }: { html: string; text: string }) {
  // ruleid: dangerously-set-inner-html
  const a = <div dangerouslySetInnerHTML={{ __html: html }} />;
  // ok: dangerously-set-inner-html
  const b = <div>{text}</div>;
  return [a, b];
}

// ---- math-random-for-security ----
function tokens() {
  // ruleid: math-random-for-security
  const weak = Math.random().toString(36);
  // ok: math-random-for-security
  const strong = generateToken();
  return [weak, strong];
}

// ---- cookie-without-httponly ----
async function setCookies(response: NextResponse, token: string, secure: boolean) {
  // ok: cookie-without-httponly
  response.cookies.set("jt-csrf", token, { httpOnly: true, secure, sameSite: "lax", path: "/" });
  // ruleid: cookie-without-httponly
  response.cookies.set("jt-csrf", token, { secure, sameSite: "lax", path: "/" });
  const jar = await cookies();
  // ok: cookie-without-httponly
  jar.set("session", token, { httpOnly: true, secure, sameSite: "lax", path: "/" });
  // ruleid: cookie-without-httponly
  jar.set("session", token, { secure, path: "/" });
}

// ---- forwarded-for-read-directly ----
async function ip() {
  const h = await headers();
  // ok: forwarded-for-read-directly
  const good = forwardedClientIp(h.get("x-forwarded-for"));
  // ruleid: forwarded-for-read-directly
  const bad = h.get("x-forwarded-for")?.split(",")[0];
  return [good, bad];
}

// ---- rate-limit-fails-open ----
async function takeTokenOld(name: string, key: string | null): Promise<boolean> {
  // ruleid: rate-limit-fails-open
  if (!key) return true;
  return consume(name, key);
}

async function takeIpToken(name: string, ip: string | null): Promise<boolean> {
  // ok: rate-limit-fails-open
  if (ip) return consume(name, ip);
  return consume(name, "all");
}

// ---- server-fetch-outside-ssrf-guard ----
async function importPage(url: string) {
  // ruleid: server-fetch-outside-ssrf-guard
  const bad = await fetch(url);
  // ruleid: server-fetch-outside-ssrf-guard
  https.get(url, () => {});
  // ok: server-fetch-outside-ssrf-guard
  const good = await safeFetch(url);
  return [bad, good];
}
