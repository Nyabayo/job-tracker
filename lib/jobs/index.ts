import "server-only";
import { PgBoss } from "pg-boss";
import { env } from "@/lib/env";
import {
  ACCOUNT_PURGE_QUEUE,
  ACCOUNT_PURGE_SWEEP_QUEUE,
  accountsAwaitingPurge,
  purgeAccount,
} from "@/lib/jobs/account-purge";

// Background jobs run inside the app process on pg-boss, which keeps its
// queue in Postgres (schema "pgboss"), so self-hosters need no extra service.

type PurgeData = { userId: string };

const globalForBoss = globalThis as unknown as { jobTrackerBoss?: Promise<PgBoss> };

async function createBoss(): Promise<PgBoss> {
  const boss = new PgBoss({
    connectionString: env().DATABASE_URL,
    schema: "pgboss",
    // The schema is created up front by prisma/roles.sql, owned by jt_app, so
    // the app role never needs CREATE rights on the database.
    createSchema: false,
    max: 3,
  });
  boss.on("error", (err: unknown) => console.error("[jobs]", err));
  await boss.start();
  await boss.createQueue(ACCOUNT_PURGE_QUEUE, { retryLimit: 10, retryDelay: 60, retryBackoff: true });
  await boss.createQueue(ACCOUNT_PURGE_SWEEP_QUEUE);
  return boss;
}

export function boss(): Promise<PgBoss> {
  globalForBoss.jobTrackerBoss ??= createBoss();
  return globalForBoss.jobTrackerBoss;
}

/** A7: queue an account for permanent deletion straight away. */
export async function enqueueAccountPurge(userId: string): Promise<void> {
  const b = await boss();
  await b.send(ACCOUNT_PURGE_QUEUE, { userId } satisfies PurgeData, { singletonKey: userId });
}

/** Starts the workers and schedules. Called once from instrumentation.ts. */
export async function startWorkers(): Promise<void> {
  const b = await boss();

  await b.work<PurgeData>(ACCOUNT_PURGE_QUEUE, async (jobs) => {
    for (const job of jobs) await purgeAccount(job.data.userId);
  });

  // Safety net for the 24 hour promise: every hour, re-queue any account that
  // is marked for deletion but still present (for example after an outage).
  await b.schedule(ACCOUNT_PURGE_SWEEP_QUEUE, "17 * * * *");
  await b.work(ACCOUNT_PURGE_SWEEP_QUEUE, async () => {
    for (const userId of await accountsAwaitingPurge()) await enqueueAccountPurge(userId);
  });
}
