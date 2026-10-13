// Runs once when the Next.js server starts (Node.js runtime only).
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { env } = await import("@/lib/env");
  const { assertSafeDatabaseRole } = await import("@/lib/db/role-check");
  const e = env();

  // A5: never run with a database role that could bypass row-level security.
  await assertSafeDatabaseRole(e.DATABASE_URL, "DATABASE_URL");
  await assertSafeDatabaseRole(e.DATABASE_URL_AUTH, "DATABASE_URL_AUTH");

  const { ensureBucket } = await import("@/lib/storage");
  await ensureBucket();

  if (e.RUN_JOBS) {
    const { startWorkers } = await import("@/lib/jobs");
    await startWorkers();
  }
}
