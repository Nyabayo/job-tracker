import "server-only";
import { Client } from "pg";

/**
 * Refuses to run if a runtime database URL connects as a role that could
 * bypass row-level security: a superuser, a BYPASSRLS role, or the owner of
 * the tables. Called once at server start (instrumentation.ts).
 */
export async function assertSafeDatabaseRole(connectionString: string, label: string): Promise<void> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const { rows } = await client.query<{ rolsuper: boolean; rolbypassrls: boolean; owns_users: boolean }>(`
      SELECT r.rolsuper, r.rolbypassrls,
             EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'users' AND tableowner = current_user) AS owns_users
      FROM pg_roles r WHERE r.rolname = current_user`);
    const role = rows[0];
    if (!role) throw new Error(`${label}: could not read the current database role`);
    if (role.rolsuper || role.rolbypassrls || role.owns_users) {
      throw new Error(
        `${label} connects as a role that can bypass row-level security. ` +
          "Use the jt_app / jt_auth roles, never the owner or a superuser.",
      );
    }
  } finally {
    await client.end();
  }
}
