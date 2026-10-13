import { Client } from "pg";
import { authDb } from "@/lib/db";
import { dbUrls } from "./env";

/** Runs SQL as the owner role (bypasses RLS) to inspect what really happened. */
export async function asOwner<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const c = new Client({ connectionString: dbUrls.owner });
  await c.connect();
  try {
    return (await c.query<T>(sql, params)).rows;
  } finally {
    await c.end();
  }
}

/** Runs SQL as a given role on a fresh connection, without app.user_id set. */
export async function asRole<T extends Record<string, unknown>>(role: "app" | "auth", sql: string, params: unknown[] = []): Promise<T[]> {
  const c = new Client({ connectionString: dbUrls[role] });
  await c.connect();
  try {
    return (await c.query<T>(sql, params)).rows;
  } finally {
    await c.end();
  }
}

let counter = 0;

/** Creates a verified user through the auth role, as sign-up does. */
export async function createUser(label: string): Promise<{ id: string; email: string }> {
  counter += 1;
  const email = `${label}-${counter}-${Date.now()}@example.test`;
  const user = await authDb().user.create({
    data: { email, emailVerified: new Date(), passwordHash: "not-a-real-hash" },
    select: { id: true, email: true },
  });
  return user;
}
