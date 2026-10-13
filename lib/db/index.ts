import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { env } from "@/lib/env";

// Two database clients, two Postgres roles (A5):
// - appDb (jt_app): every request that touches user data. Only usable through
//   withUser(), which sets app.user_id so RLS filters every query.
// - authDb (jt_auth): sign-up, login, sessions and tokens, before a user id is
//   known. It cannot see jobs, documents or any other user data.

type Clients = { app: PrismaClient; auth: PrismaClient };

const globalForDb = globalThis as unknown as { jobTrackerDb?: Clients };

function createClients(): Clients {
  return {
    app: new PrismaClient({ adapter: new PrismaPg({ connectionString: env().DATABASE_URL, max: 10 }) }),
    auth: new PrismaClient({ adapter: new PrismaPg({ connectionString: env().DATABASE_URL_AUTH, max: 5 }) }),
  };
}

function clients(): Clients {
  globalForDb.jobTrackerDb ??= createClients();
  return globalForDb.jobTrackerDb;
}

export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/** Client for auth flows only (jt_auth role). */
export function authDb(): PrismaClient {
  return clients().auth;
}

/**
 * Runs `fn` inside a transaction scoped to one user. The first statement sets
 * app.user_id for this transaction only, so every query in `fn` is filtered by
 * row-level security. This is the only way app code may read or write user data.
 */
export async function withUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return clients().app.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
    return fn(tx);
  });
}
